var EventEmitter = require('events').EventEmitter,
    error = require('../util/error'),
    util = require('util'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    Activity = mongoose.model('Activity'),
    email = require('../util/email'),
    log = require('../util/log').logger,
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    i18n = require('../util/ypi18n').initialize(),
    generic = require('../handlers/generic');


function SocialInteraction() {
    EventEmitter.call(this);
}

util.inherits(SocialInteraction, EventEmitter);


var SocialInteraction = new SocialInteraction();

SocialInteraction.allUsers = 'ALL_USERS';

// when a user signs up, check if there are any invitations for the user's email address and convert them
User.on('add', function (user) {

    Invitation.update(
        { 'targetSpaces.targetValue': user.email },
        {
            $set: {
                'targetSpaces.$.targetId': user._id,
                'targetSpaces.$.type': 'user'
            },
            $unset: {
                'targetSpaces.$.targetValue': 1
            }

        }, function (err, numAffected) {
            if(err) {
                return SocialInteraction.emit('error', err);
            }
        }
    );

});


// send email invitations
mongoose.model('Invitation').on('add', function(invitation) {
    var activity = _.find(invitation.refDocs, { model: 'Activity'});

    // invitations for activities
    if(activity) {
        Activity.findById(activity.docId).populate('idea').exec(function (err, activity) {
            var userIds = _.map(_.filter(invitation.targetSpaces, { type: 'user'}), 'targetId');
            // get author
            User.findById(invitation.author).exec(function (err, author) {
                // get all targeted users
                User.find({ _id: { $in: userIds}}).select('+email').exec(function (err, users) {
                    _.each(users, function (user) {
                        email.sendActivityInvite(user.email, author, activity, user, invitation._id, i18n);
                    });
                });
            });

        });
    }
});

SocialInteraction.on('socialInteraction:dismissed', function (user, socialInteraction, socialInteractionDismissed) {

    // check if a recommendation for an idea is dismissed, add an rejectedIdea to the user profile
    if(socialInteraction.__t === 'Recommendation' && socialInteractionDismissed.reason === 'denied') {
        var refDocIdea = _.find(socialInteraction.refDocs, { model: 'Idea'});
        var profile = user.profile;
        profile.prefs.rejectedIdeas.push({
            timestamp: new Date(),
            idea: refDocIdea.docId
        });
        profile.save(function (err) {
            if(err) {
                return SocialInteraction.emit('error', err);
            }
        });
    }
});


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
        } else if (typeof recipient === 'string') {
            targetSpaces.push({
                type: 'email',
                targetValue: recipient
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

    // keep email addresses by userId for later use
    var usersById = {};
    _.each(to, function (recipient) {
        if(typeof recipient === 'object' && recipient.constructor.modelName === 'User') {
            usersById[recipient._id] = recipient;
        }
    });

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

        _.each(inv.targetSpaces, function (space) {

            if(space.type === 'user' || space.type === 'email') {
                var emailAddress = space.type === 'user' ? usersById[space.targetId].email : space.targetValue;
                email.sendActivityInvite(emailAddress, from, activity, usersById[space.targetId], inv._id, i18n);
            }

        });

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

SocialInteraction.dismissRecommendations = function dismissInvitations(refDoc, users, documentTemplate, cb) {
    SocialInteraction.dismissSocialInteraction(Recommendation, refDoc, users, documentTemplate, cb);
};

SocialInteraction.dismissInvitations = function dismissInvitations(refDoc, users, documentTemplate, cb) {
    SocialInteraction.dismissSocialInteraction(Invitation, refDoc, users, documentTemplate, cb);
};

SocialInteraction.dismissSocialInteraction = function dismissSocialInteraction(model, refDoc, users, documentTemplate, cb) {

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
                dismissals.push(SocialInteraction.dismissSocialInteractionById.bind(null, socialInteraction._id, user, documentTemplate));
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

SocialInteraction.dismissSocialInteractionById = function dismissSocialInteraction(socialInteractionId, user, documentTemplate, cb) {


    SocialInteractionModel.findById(socialInteractionId, function (err, socialInteraction) {

        if (err) {
            return cb(err);
        }

        if (!socialInteraction) {
            return cb(new Error('Social Interaction not found: ' + socialInteractionId));
        }

        var userId = (user._id ? user._id : user);

        var document = _.extend(documentTemplate, {
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });
        var socialInteractionDismissed = new SocialInteractionDismissedModel(document);

        return socialInteractionDismissed.save(function (err, saved) {
            // we deliberately want to ignore DuplicateKey Errors, because there is not reason to store the dissmissals more than once
            // MONGO Duplicate KeyError code: 11000
            if (err) {
                if(err.code !== 11000) {
                    return cb(err);
                } else {
                    return cb(null);
                }
            } else {
                SocialInteraction.emit('socialInteraction:dismissed', user, socialInteraction, saved);
                return cb(null);
            }

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

    function _populateTargetedUsers(donePopulating) {
        async.each(_.filter(socialInteraction.targetSpaces, { type: 'user'}), function (targetSpace, done) {
            User.findById(targetSpace.targetId).exec(function(err, user) {
                if (err) {
                    return done(err);
                }
                targetSpace.user = user;
                done();
            });
        }, function (err, results) {
            return donePopulating(err);
        });
    }

    function _populateRefDocs(donePopulating) {
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
            return donePopulating(err);
        });
    }

    async.parallel([_populateTargetedUsers, _populateRefDocs], function(err) {
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
        SocialInteractionDismissedModel.find({ user: user._id }, function (err, results) {

            if (err) {
                return done(err);
            }

            // needed to set the dismissalReason of a socialInteraction
            locals.socialInteractionDismissed = results;

            if(options.dismissed && options.dismissalReason) {
                // all dismissed si's except the ones with the specified reason
                locals.dismissedSocialInteractions = _.map(_.filter(results, function(sid) {
                    return sid.reason !== options.dismissalReason;
                }), 'socialInteraction');
            } else {
                locals.dismissedSocialInteractions = _.map(results, 'socialInteraction');
            }

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

        function populateDismissedStatus() {

            if (options.dismissed) {
                _.forEach(socialInteractions, function (si) {
                    var sid = _.find(locals.socialInteractionDismissed, function (dsi) {
                        return si._id.equals(dsi.socialInteraction);
                    });
                    if(sid) {
                        si.dismissed = true;
                        si.dismissalReason = sid.reason;
                    }
                });
            }
        }
        function populateRejectedStatus() {
            if (options.rejected) {

                if(!options.populateRefDocs) {
                    throw new Error("can't populate rejected status without populated refDocs");
                }

                _.forEach(socialInteractions, function (si) {
                    si.rejected = _.any(user.profile.prefs.rejectedIdeas, function (rejectedIdeaObj) {
                        return _.any(si.refDocs, function(refDoc) {
                            return refDoc.docId.equals(rejectedIdeaObj.idea) ||
                                refDoc.doc && refDoc.doc.idea && refDoc.doc.idea._id.equals(rejectedIdeaObj.idea);
                        });
                    });
                });
            }
        }

        var populateRefDocs = options.populateRefDocs || (options.queryOptions.populate && options.queryOptions.populate.indexOf('refDocs') !== -1);
        if (populateRefDocs) {
            return async.each(socialInteractions, function (si, done) {
                SocialInteraction.populateSocialInteraction(si, null, done);
            }, function (err) {
                if (err) {
                    return cb(err);
                }
                populateDismissedStatus();
                populateRejectedStatus();
                return cb(err, socialInteractions);
            });
        } else {
            populateDismissedStatus();
            populateRejectedStatus();
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

                var finder = {};

                if (options.targetId) {
                    finder.targetSpaces = {
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

                    finder.targetSpaces = {
                        $elemMatch: {
                            $or: orClauses
                        }
                    };
                }

                var dbQuery = model.find(finder);

                if(options.publishFrom) {
                    var publishFrom = (typeof options.publishFrom === 'boolean') ? now : moment(options.publishFrom).toDate();
                    dbQuery
                        .and({$or: [
                            {publishFrom: {$exists: false}},
                            {publishFrom: {$lte: publishFrom}}
                        ]});
                }
                if(options.publishTo) {
                    var publishTo = (typeof options.publishTo === 'boolean') ? now : moment(options.publishTo).toDate();
                    dbQuery
                        .and({$or: [
                            {publishTo: {$exists: false}},
                            {publishTo: {$gte: publishTo}}
                        ]});
                }

                if (options.authorType) {
                    dbQuery.and({ authorType: options.authorType });
                }

                // skip if include dismissed and no reason
                if (!options.dismissed || options.dismissalReason) {
                    dbQuery.and({_id: { $nin: locals.dismissedSocialInteractions }});
                }

                if (!options.rejected && user.profile.prefs.rejectedIdeas) {
                    var rejectedIdeas = _.map(user.profile.prefs.rejectedIdeas, 'idea');
                    dbQuery.and({ $or: [
                        { targetSpaces: { $elemMatch: { type: 'user', targetId: user._id }}}, // personal, target directly to the user
                        { refDocs: { $size: 0 } }, // no ref docs, can't be rejected
                        { refDocs: { $elemMatch: { docId: { $nin: rejectedIdeas } } } } // or not rejected
                    ]});
                }
                if (!options.authored) {
                    dbQuery.and({ author: { $ne: user._id } });
                }

                if(options.discriminators) {
                    dbQuery.and({ __t: { $in: options.discriminators } });
                }
                if(options.refDocId) {
                    dbQuery.and({refDocs: { $elemMatch: {docId: options.refDocId}}});
                }

                if (user.profile.language) {
                    dbQuery.and({ $or: [
                        {language: {$exists: false}},
                        {language: user.profile.language}
                    ] });
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

SocialInteraction.getInvitationStatus = function (activityId, cb) {

    Activity.findById(activityId, function(err, activity) {

        Invitation.find({ refDocs: { $elemMatch: { docId: activity.id }}}).exec(function(err, invitations) {
            if (err) {
                return cb(err);
            }

            SocialInteractionDismissedModel.find({ socialInteraction: { $in: _.map(invitations, '_id') }}).exec(function (err, sidList) {
                if (err) {
                    return cb(err);
                }

                var userResults = [];

                var emailResults = [];

                _.each(invitations, function (invitation) {


                    _.each(_.filter(invitation.targetSpaces, { type: 'email'}), function(space) {

                        var emailResult = {
                            email: space.targetValue,
                            status: 'pending'
                        };
                        emailResults.push(emailResult);
                    });

                    _.each(_.filter(invitation.targetSpaces, { type: 'user'}), function(space) {
                        var sid = _.find(sidList, { socialInteraction: invitation._id, user: space.targetId });

                        var userResult = {
                            user: space.targetId,
                            status: sid ? sid.reason : 'pending'
                        };
                        userResults.push(userResult);
                    });

                });

                mongoose.model('User').populate(userResults, {path: 'user', model: 'User'}, function(err, userResults) {
                    cb(err, userResults.concat(emailResults));
                });
            });
        });
    });

};

module.exports = SocialInteraction;
