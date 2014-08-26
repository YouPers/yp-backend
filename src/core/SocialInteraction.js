var EventEmitter = require('events').EventEmitter,
    error = require('../util/error'),
    util = require('util'),
    mongoose = require('mongoose'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    Activity = mongoose.model('Activity'),
    log = require('../util/log').logger,
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    generic = require('../handlers/generic');


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

    _.forEach(recipients, function (recipient) {
        if (typeof recipient === 'object' && recipient.constructor.modelName === 'User') {
            targetSpaces.push({
                type: 'user',
                targetId: recipient._id
            });
        } else if (typeof recipient === 'object' && recipient.constructor.modelName === 'Campaign') {
            targetSpaces.push({
                type: 'campaign',
                targetId: recipient._id
            });
        } else if (typeof to === 'string') {
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
        idea: activity.idea,
        refDocs: [
            { docId: activity._id, model: 'Activity'}
        ],
        publishTo: activity.lastEventEnd
    });

    invitation.save(function (err, inv) {
        if (err) {
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
        refDocs: [
            { docId: campaign._id, model: 'Campaign'}
        ],
        publishTo: campaign.end
    });

    invitation.save(function (err, inv) {
        if (err) {
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
        refDocs: [
            { docId: organization._id, model: 'Organization'}
        ]
    });

    invitation.save(function (err, inv) {
        if (err) {
            SocialInteraction.emit('error', err);
        }
    });
});


SocialInteraction.on('error', function (err) {
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

    if (!allUsers) {
        if (!_.isArray(users)) {
            userIds = [users];
        }

        userIds = _.map(_.clone(userIds), function (user) {
            if (typeof user === 'object' && user._id) {
                return user._id;
            } else if (user instanceof mongoose.Types.ObjectId) {
                return user;
            } else {
                var err = new Error('invalid argument users');
                if (cb) {
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
            docId: refDoc._id || refDoc
        }
    };

    // find all soi for this refDoc targeted to one of these users
    model.find(finder).exec(function (err, socialInteractions) {
        if (err) {
            return error.handleError(err, cb);
        }

        // for each soi, find all relevant users and dismiss the invitation
        _.forEach(socialInteractions, function (socialInteraction) {

            var spaces = allUsers ? socialInteraction.targetSpaces : _.filter(socialInteraction.targetSpaces, function (space) {
                return _.any(userIds, function (user) {
                    return user.equals(space.targetId);
                });
            });

            var users = _.map(spaces, 'targetId');

            var dismissals = [];

            _.forEach(users, function (user) {
                dismissals.push(SocialInteraction.dismissSocialInteractionById.bind(null, socialInteraction._id, user));
            });

            async.parallel(dismissals, function (err) {
                if (err) {
                    return error.handleError(err, cb);
                }
                if (cb) {
                    cb();
                }
            });
        });
    });

};

SocialInteraction.dismissSocialInteractionById = function dismissSocialInteraction(socialInteractionId, user, cb) {


    SocialInteractionModel.findById(socialInteractionId, function (err, socialInteraction) {

        if (err) {
            return cb(err);
        }

        if (!socialInteraction) {
            return cb(new Error('Social Interaction not found: ' + socialInteractionId));
        }

        var userId = (user._id ? user._id : user);

        var socialInteractionDismissed = new SocialInteractionDismissedModel({
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });

        return socialInteractionDismissed.save(function (err) {
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
SocialInteraction.populateSocialInteraction = function (socialInteraction, campaignId, cb) {

    async.each(socialInteraction.refDocs, function (refDoc, done) {

        mongoose.model(refDoc.model).findById(refDoc.docId).populate('idea').exec(function (err, document) {

            // store the populated document in the refDoc
            refDoc.doc = document;

            if (campaignId && refDoc.model === 'Idea') {

                // calculate the count this idea has been planned within the campaign
                Activity.count({
                    idea: document._id,
                    campaign: campaignId
                }).exec(function (err, count) {
                    if (err) {
                        return done(err);
                    }
                    log.debug({count: count}, 'plan Count');
                    socialInteraction.planCount = count;
                    return done();
                });
            } else {
                return done(err);
            }
        });

    }, function (err, results) {
        return cb(err, socialInteraction);
    });

};

/**
 * returns all SocialInteractions for the currently logged in user. With the optional options-object several aspects
 * can be configured:
 * options.refDocId: if this is passed, only SOI that reference this Document are returned
 * options.mode: one of "admin", "campaignlead" or "user". Defaults to "user" if missing.
 * options.campaignId: The Id of the campaign whose sois are to be returned, only considered in campaignlead mode
 * options.queryOptions: the usual queryOptions {limit, sort, populate} fields
 * options.locale: the current locale to be used if i18n-fields are to be loaded
 * options.populateRefDocs: boolean, true if refDocs are to be populated
 *
 * @param user the user for who the sois are loaded
 * @param model the soi-model to use, can be SocialInteration or one of it subclasses
 * @param options
 * @param cb
 */
SocialInteraction.getAllForUser = function (user, model, options, cb) {

    log.debug('SocialInteraction.getAllForUser', {user: user, model: model, options: options});

    var adminMode = options.mode === 'admin';
    var locale = options && options.locale;
    var locals = {};

    function _loadSocialInteractionDismissed(done) {
        SocialInteractionDismissedModel.find({ user: user._id }, function (err, sid) {

            if (err) {
                return done(err);
            }

            locals.dismissedSocialInteractions = _.map(sid, 'socialInteraction');
            return done();
        });
    }

    function _loadActivities(done) {
        mongoose.model('Activity').find({ $or: [
            { owner: user._id },
            { joiningUsers: user._id }
        ]}, function (err, activities) {
            if (err) {
                return done(err);
            }
            locals.activityIds = _.map(activities, '_id');
            return done();
        });
    }

    function _soiLoadCb(err, socialInteractions) {
        if (err) {
            return cb(err);
        }
        log.debug('SocialInteraction.getAllForUser: found sois: ' + socialInteractions.length, socialInteractions);

        if (options.dismissed) {
            _.forEach(socialInteractions, function (si) {
                si.dismissed = _.any(locals.dismissedSocialInteractions, function (dsi) {
                    return si._id.equals(dsi);
                });
            });
        }
        if (options.rejected) {
            _.forEach(socialInteractions, function (si) {
                si.rejected = _.any(user.rejectedIdeas, function (idea) {
                    return _.any(si.refDocs, function(refDoc) {
                        refDoc.docId.equals(idea);
                    });
                });
            });
        }

        var populateRefDocs = options.populateRefDocs || (options.queryOptions.populate && options.queryOptions.populate.indexOf('refDocs') !== -1);
        if (populateRefDocs) {
            return async.each(socialInteractions, function (si, done) {
                SocialInteraction.populateSocialInteraction(si, null, done);
            }, function (err) {
                if (err) {
                    return cb(err);
                }
                return cb(err, socialInteractions);
            });
        } else {
            return cb(err, socialInteractions);
        }
    }

    function _loadUserMode() {
        async.parallel([_loadSocialInteractionDismissed, _loadActivities],
            function (err) {
                if (err) {
                    return cb(err);
                }
                var now = moment().toDate();

                var targetSpaceFinder = {};

                if (options.targetId) {
                    targetSpaceFinder.targetSpaces = {
                        $elemMatch: {
                            targetId: options.targetId
                        }
                    };
                } else {
                    var orClauses = [
                        { type: 'user', targetId: user._id },
                        { type: 'system' },
                        { $and: [
                            {type: 'activity'},
                            {targetId: {$in: locals.activityIds}}
                        ]}
                    ];
                    if (user.campaign) {
                        orClauses.push({ type: 'campaign', targetId: user.campaign._id });
                    }

                    targetSpaceFinder.targetSpaces = {
                        $elemMatch: {
                            $or: orClauses
                        }
                    };
                }
                var dbQuery = model.find(targetSpaceFinder);
                dbQuery
                    .and({$or: [
                        {publishTo: {$exists: false}},
                        {publishTo: {$gte: now}}
                    ]})
                    .and({$or: [
                        {publishFrom: {$exists: false}},
                        {publishFrom: {$lte: now}}
                    ]});

                if (options.authorType) {
                    dbQuery.and({ authorType: options.authorType });
                }
                if (!options.dismissed) {
                    dbQuery.and({_id: { $nin: locals.dismissedSocialInteractions }});
                }
                if (!options.rejected && user.profile.rejectedIdeas) {
                    var rejectedIdeas = _.map(user.profile.rejectedIdeas, 'idea');
                    dbQuery.and({ $or: [
                        { targetSpaces: { $elemMatch: { type: 'user', targetId: user._id }}}, // personal, target directly to the user
                        { refDocs: { $elemMatch: { docId: { $nin: rejectedIdeas } } } } // or not rejected
                    ]});
                }
                if (!options.authored) {
                    dbQuery.and({ author: { $ne: user._id } });
                }

                if(options.discriminators) {
                    dbQuery.and({ __t: { $in: options.discriminators } });
                }

                if (user.profile.language) {
                    dbQuery.and({ $or: [
                        {language: {$exists: false}},
                        {language: user.profile.language}
                    ] });
                }
                if (options.refDocId) {
                    dbQuery.and({ refDocs: { $elemMatch: {docId: options.refDocId}}});
                }
                generic.processDbQueryOptions(options.queryOptions, dbQuery, locale, model)
                    .exec(_soiLoadCb);
            }
        );
    }

    function _loadAdminMode() {
        var dbQuery = model.find();
        generic.processDbQueryOptions(options.queryOptions, dbQuery, locale, model)
            .exec(_soiLoadCb);
    }

    if (adminMode) {
        _loadAdminMode();
    } else {
        _loadUserMode();
    }
};

module.exports = SocialInteraction;
