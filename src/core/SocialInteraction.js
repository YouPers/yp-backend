var EventEmitter = require('events').EventEmitter,
    error = require('../util/error'),
    util = require('util'),
    mongoose = require('mongoose'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    Activity = mongoose.model('Activity'),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    _ = require('lodash'),
    async = require('async');


function SocialInteraction() {
    EventEmitter.call(this);
}

util.inherits(SocialInteraction, EventEmitter);


var SocialInteraction = new SocialInteraction();

SocialInteraction.allUsers = 'ALL_USERS';


/**
 *
 * @param to        single or multiple recipients, can either be email addresses or users
 * @returns {Array} targetSpaces
 * @private
 */
function _createTargetSpacesFromRecipients(to) {
    var recipients = _.isArray(to) ? to : [to];
    var targetSpaces = [];

    _.forEach(recipients, function(recipient) {
        if(typeof recipient === 'object' && recipient.constructor.modelName === 'User') {
            targetSpaces.push({
                type: 'user',
                targetId: recipient._id
            });
        } else if(typeof recipient === 'object' && recipient.constructor.modelName === 'Campaign') {
            targetSpaces.push({
                type: 'campaign',
                targetId: recipient._id
            });
        } else if(typeof to === 'string') {
            targetSpaces.push({
                type: 'email',
                targetId: recipient
            });
        }
    });
    return targetSpaces;
}

/**
 * store invitations for an activity
 *
 * @param from      inviting user / author
 * @param to        single or multiple recipients, can either be email addresses or users
 * @param activity  the referenced activity
 *
 */
SocialInteraction.on('invitation:activity', function (from, to, activity) {

    var invitation = new Invitation({
        author: from._id,
        targetSpaces: _createTargetSpacesFromRecipients(to),
        refDocs: [{ docId: activity._id, model: 'Activity'}],
        publishTo: activity.lastEventEnd
    });

    invitation.save(function(err, inv) {
        if(err) {
            SocialInteraction.emit('error', err);
        }
    });
});

/**
 * store invitations for a campaignLead
 *
 * @param from      inviting user / author
 * @param to        single or multiple recipients, can either be email addresses or users
 * @param activity  the referenced campaign
 *
 */
SocialInteraction.on('invitation:campaignLead', function (from, to, campaign) {

    var invitation = new Invitation({
        author: from._id,
        targetSpaces: _createTargetSpacesFromRecipients(to),
        refDocs: [{ docId: campaign._id, model: 'Campaign'}],
        publishTo: campaign.end
    });

    invitation.save(function(err, inv) {
        if(err) {
            SocialInteraction.emit('error', err);
        }
    });
});

/**
 * store invitations for an organization admin
 *
 * @param from      inviting user / author
 * @param to        single or multiple recipients, can either be email addresses or users
 * @param activity  the referenced organization
 *
 */
SocialInteraction.on('invitation:organizationAdmin', function (from, to, organization) {

    var invitation = new Invitation({
        author: from._id,
        targetSpaces: _createTargetSpacesFromRecipients(to),
        refDocs: [{ docId: organization._id, model: 'Organization'}]
    });

    invitation.save(function(err, inv) {
        if(err) {
            SocialInteraction.emit('error', err);
        }
    });
});


SocialInteraction.on('error', function(err) {
    log.error(err);
    throw new Error(err);
});

SocialInteraction.dismissRecommendations = function dismissInvitations(refDoc, users, cb) {
    SocialInteraction.dismissSocialInteraction(Recommendation, refDoc, users, cb);
};

SocialInteraction.dismissInvitations = function dismissInvitations(refDoc, users, cb) {
    SocialInteraction.dismissSocialInteraction(Invitation, refDoc, users, cb);
};

SocialInteraction.dismissSocialInteraction = function dismissSocialInteraction(model, refDoc, users, cb) {

    var userIds;

    var allUsers = users === SocialInteraction.allUsers;

    if(!allUsers) {
        if(!_.isArray(users)) {
            userIds = [users];
        }

        userIds = _.map(_.clone(userIds), function(user) {
            if( typeof user === 'object' && user._id) {
                return user._id;
            } else if (user instanceof mongoose.Types.ObjectId) {
                return user;
            } else {
                var err = new Error('invalid argument users');
                if(cb) {
                    cb(err);
                } else {
                    SocialInteraction.emit('error', err);
                }
            }
        });
    }

    var finder = allUsers ? {} : {
        targetSpaces: {
            $elemMatch: {
                type: 'user',
                targetId: { $in: userIds }
            }
        }
    };

    finder.refDocs = {
        $elemMatch: {
        docId: refDoc._id,
        model: refDoc.constructor.modelName
        }
    };

    // find all invitations for this refDoc targeted to one of these users
    model.find(finder).exec(function(err, socialInteractions) {

        // for each invitation, find all relevant users and dismiss the invitation
        _.forEach(socialInteractions, function (socialInteraction) {

            var spaces = allUsers ? socialInteraction.targetSpaces : _.filter(socialInteraction.targetSpaces, function(space) {
                return _.any(userIds, function(user) {
                    return user.equals(space.targetId);
                });
            });

            var users = _.map(spaces, 'targetId');

            var dismissals = [];

            _.forEach(users, function(user) {
                dismissals.push(SocialInteraction.dismissSocialInteractionById.bind(null, socialInteraction._id, user));
            });

            async.parallel(dismissals, function (err) {
                if (err) {
                    return error.handleError(err, cb);
                }
                if(cb) {
                    cb();
                }
            });
        });
    });

};

SocialInteraction.dismissSocialInteractionById = function dismissSocialInteraction(socialInteractionId, user, cb) {


    SocialInteractionModel.findById(socialInteractionId, function(err, socialInteraction) {

        if(err) {
            cb(err);
        }

        var userId = (user._id ? user._id : user);

        // just delete the socialInteraction if the only targeted space is the user
        // -> if there are no other target spaces than for this user
        if(!_.any(socialInteraction.targetSpaces, function(space) {
            return space.targetModel !== 'User' || !space.targetId.equals(userId);
        })) {
            return socialInteraction.remove(cb);
        }

        var socialInteractionDismissed = new SocialInteractionDismissedModel({
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });

        return socialInteractionDismissed.save(function(err) {
            // we deliberately want to ignore DuplicateKey Errors, because there is not reason to store the dissmissals more than once
            // MONGO Duplicate KeyError code: 11000
            if (err && err.code !== 11000) {
                return cb(err);
            }
            return cb(null);
        });

    });

};


/**
 *
 * populate the refDocs of a socialInteraction, store them in refDoc.doc
 *
 * NOTE: campaignId is optional!
 *
 * @param socialInteraction
 * @param campaignId - optional, needed for the count an activity has been planned within a campaign
 * @param cb
 */
SocialInteraction.populateSocialInteraction = function(socialInteraction, campaignId, cb) {

    async.each(socialInteraction.refDocs, function(refDoc, done) {

        mongoose.model(refDoc.model).findById(refDoc.docId).populate('idea').exec(function (err, document) {

            // store the populated document in the refDoc
            refDoc.doc = document;

            if(campaignId && refDoc.model === 'Idea') {

                // calculate the count this idea has been planned within the campaign
                Activity.count({
                    idea: document._id,
                    campaign: campaignId
                }).exec(function (err, count) {
                    if (err) {
                        return done(err);
                    }
                    log.info({count: count}, 'plan Count');
                    socialInteraction.planCount = count;
                    return done();
                });
            } else {
                return done(err);
            }
        });

    }, function(err, results) {
        return cb(err, socialInteraction);
    });

};

module.exports = SocialInteraction;
