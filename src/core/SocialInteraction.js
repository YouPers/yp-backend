var EventEmitter = require('events').EventEmitter,
    error = require('ypbackendlib').error,
    util = require('util'),
    mongoose = require('ypbackendlib').mongoose,
    User = mongoose.model('User'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    Activity = mongoose.model('Activity'),
    email = require('../util/email'),
    config = require('../config/config'),
    log = require('ypbackendlib').log(config),
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    i18n = require('ypbackendlib').i18n(config).initialize(),
    generic = require('ypbackendlib').handlers;


function SocialInteraction() {
    EventEmitter.call(this);
}

util.inherits(SocialInteraction, EventEmitter);


var SocialInteraction = new SocialInteraction();

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
            if (err) {
                return SocialInteraction.emit('error', err);
            }
        }
    );

});


// send email invitations
mongoose.model('Invitation').on('add', function (invitation) {

    log.debug('Invitation:add', invitation);

    var activity = invitation.activity;

    // invitations for activities
    if (activity) {
        Activity.findById(activity._id || activity).populate('idea').exec(function (err, activity) {
            if(err) {
                return SocialInteraction.emit('error', err);
            }
            if(!activity) {
                return SocialInteraction.emit('error', 'activity not found: ' + activity._id || activity);
            }

            var userIds = _.map(_.filter(invitation.targetSpaces, 'type', 'user'), 'targetId');
            var campaignIds = _.map(_.filter(invitation.targetSpaces, 'type', 'campaign'), 'targetId');

            log.debug('Invitation:add - userIds', userIds);
            log.debug('Invitation:add - campaignIds', campaignIds);

            // get author
            User.findById(invitation.author).exec(function (err, author) {

                var userQuery = {
                    $or: [
                        { _id: { $in: userIds} },
                        { campaign: { $in: campaignIds } },
                    ],
                    _id: { $ne: author._id }
                };

                // get all targeted users
                User.find(userQuery).select('+email').exec(function (err, users) {
                    _.each(users, function (user) {
                        log.debug('Invitation:add - sendActivityInvite', user.email);
                        email.sendActivityInvite(user.email, author, activity, user, invitation._id, i18n);
                    });
                });
            });

        });
    }
});

SocialInteraction.on('socialInteraction:dismissed', function (user, socialInteraction, socialInteractionDismissed) {

    // check if a recommendation for an idea is dismissed, add an rejectedIdea to the user profile
    if (socialInteraction.__t === 'Recommendation' && socialInteractionDismissed.reason === 'denied') {
        var ideaId = socialInteraction.idea._id || socialInteraction.idea;
        var profile = user.profile;
        profile.prefs.rejectedIdeas.push({
            timestamp: new Date(),
            idea: ideaId
        });
        profile.save(function (err) {
            if (err) {
                return SocialInteraction.emit('error', err);
            }
        });
    }
});


mongoose.model('Campaign').on('remove', function (campaign) {
    var finder = {
        targetSpaces: {
            $elemMatch: { type: 'campaign', targetId: campaign._id }
            }
    };

    SocialInteractionModel.find(finder).exec(function _removeAll(err, objs) {
        async.forEach(objs, function (obj, cb) {
            obj.remove(cb);
        }, function(err) {
            if (err) {
                log.error(err);
                throw err;
            }
        });
    });
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
                targetValue: recipient.toLowerCase()
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
        if (typeof recipient === 'object' && recipient.constructor.modelName === 'User') {
            usersById[recipient._id] = recipient;
        }
    });

    var invitation = new Invitation({
        author: from._id,
        targetSpaces: _createTargetSpacesFromRecipients(to),
        idea: activity.idea,
        activity: activity._id,
        publishTo: activity.lastEventEnd
    });

    invitation.save(function (err, inv) {

        _.each(inv.targetSpaces, function (space) {

            if (space.type === 'user' || space.type === 'email') {
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

SocialInteraction.dismissRecommendations = function dismissInvitations(refDoc, user, documentTemplate, cb) {
    SocialInteraction.dismissSocialInteraction(Recommendation, refDoc, user, documentTemplate, cb);
};

SocialInteraction.dismissInvitations = function dismissInvitations(refDoc, user, documentTemplate, cb) {
    SocialInteraction.dismissSocialInteraction(Invitation, refDoc, user, documentTemplate, cb);
};

SocialInteraction.removeDismissals = function (refDoc, user, cb) {

    Invitation.find({ activity: refDoc._id }).exec(function (err, invitations) {
        if (err) {
            return cb(err);
        }

        SocialInteractionDismissedModel.find(
            {
                socialInteraction: {$in: _.map(invitations, '_id')},
                user: user._id
            }
        ).remove(function (err) {
                return cb(err);
            });
    });

};

SocialInteraction.deleteSocialInteractions = function (doc, cb) {

    var finder =
    {$or: [
        {refDocs: {$elemMatch: {
            docId: doc._id || doc
        }}},
        {targetSpaces: {$elemMatch: {
            targetId: doc._id || doc
        }}},
        {activity: doc._id || doc},
        {idea: doc._id || doc}
    ]};


    SocialInteractionModel.remove(finder).exec(function (err, deleted) {
        if (err) {
            return error.handleError(err, cb);
        }
        if (cb) {
            cb();
        }
    });
};
/**
 * dismissSocialInteraction
 *
 * all parameters except the documentTemplate and the callback are required
 *
 * dismiss all social interactions for the specified:
 *
 * @param model     one of the social interaction models: Invitation, Recommendation, Message
 * @param refDoc    the referenced document, one of: Idea, Activity, Campaign, ...
 *
 * @param user      user: the user the social interaction is targeted to
 *                        will not only include the 'user' targetSpace, but all relevant spaces like 'campaign'
 *
 * @param documentTemplate
 *                  optional, the template to create the SocialInteractionDismissed document, used to store the reason for a dismissal
 *
 * @param cb        optional, callback function
 */
SocialInteraction.dismissSocialInteraction = function dismissSocialInteraction(model, refDoc, user, documentTemplate, cb) {

    function emitError(parameter) {
        SocialInteraction.emit('error', 'SocialInteraction.dismissSocialInteraction: parameter \'' + parameter + '\' is missing or not an object');
    }

    if (!model || model.name !== 'model') {
        return emitError('model');
    }
    if (!refDoc || typeof refDoc !== 'object') {
        return emitError('refDoc');
    }
    if (!user || typeof user !== 'object') {
        return emitError('user');
    }

    var targetSpace$or = [
        { type: 'user', targetId: user._id }
    ];
    if (user.campaign) {
        targetSpace$or.push({ type: 'campaign', targetId: user.campaign._id || user.campaign });
    }
    var finder = {
        targetSpaces: {
            $elemMatch: {
                $or: targetSpace$or
            }
        }
    };

    finder.$or = [
        {refDocs: {$elemMatch: {
            docId: refDoc._id || refDoc
        }}},
        {activity: refDoc._id || refDoc},
        {idea: refDoc._id || refDoc}
    ];

    // find all soi for this refDoc targeted to one of these users
    model.find(finder).exec(function (err, socialInteractions) {
        if (err) {
            return SocialInteraction.emit('error', err);
        }

        var dismissals = [];
        _.forEach(socialInteractions, function (si) {
            dismissals.push(SocialInteraction.dismissSocialInteractionById.bind(null, si._id, user, documentTemplate));
        });

        async.parallel(dismissals, function (err) {
            if (err) {
                return SocialInteraction.emit('error', err);
            }
            if (cb) {
                cb();
            }
        });
    });

};

SocialInteraction.dismissSocialInteractionById = function dismissSocialInteractionById(socialInteractionId, user, documentTemplate, cb) {


    SocialInteractionModel.findById(socialInteractionId, function (err, socialInteraction) {

        if (err) {
            return cb(err);
        }

        if (!socialInteraction) {
            return cb(new Error('Social Interaction not found: ' + socialInteractionId));
        }

        var userId = (user._id ? user._id : user);

        var document = _.extend(documentTemplate || {}, {
            user: userId,
            socialInteraction: socialInteraction.id
        });

        // Model.update does not work with undefined values
        _.each(_.keys(document), function (key) {
            if(_.isUndefined(document[key])) {
                delete document[key];
            }
        });

        // we are using model.findOneAndUpdate here, which is executed directly in mongodb, so mongoose
        // plugins are skipped: relevant for this model are the created and updated timestamps
        // so we need to set those values manually.
        // we are assuming incorrectly, that this is always a new document and overwrite the 'created' ts
        // this is not correct, but close enough for all known use cases and saves a query before the write.
        document.created =  document.updated = new Date();

        // Model.update does not return the updated SID -> findOneAndUpdate
        SocialInteractionDismissedModel.findOneAndUpdate({
            user: userId,
            socialInteraction: socialInteraction.id
        }, document, { upsert: true, new: true }, function (err, saved) {
            if (err) {
                return cb(err); // duplicate key errors will not occur anymore, because of the upsert option
            } else {

                SocialInteraction.emit('socialInteraction:dismissed', user, socialInteraction, saved);
                return cb(null);
            }

        });

    });

};


/**
 *
 * populate the a socialInteraction, store them in refDoc.doc
 *
 * NOTE: campaignId is optional!
 *
 * @param socialInteraction
 * @param campaignId - optional, needed for the count an activity has been planned within a campaign
 * @param cb
 */
function _populateSocialInteraction(socialInteraction, campaignId, locale, attrToPopulate, cb) {

    function _populateTargetedUsers(donePopulating) {
        async.each(_.filter(socialInteraction.targetSpaces, 'type', 'user'), function (targetSpace, done) {
            User.findById(targetSpace.targetId).exec(function (err, user) {
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
            var model = mongoose.model(refDoc.model);
            var q = model.findById(refDoc.docId).populate('idea', mongoose.model('Idea').getI18nPropertySelector(locale));
            q.populate('owner');

            if (model.getI18nPropertySelector) {
                q.select(model.getI18nPropertySelector(locale));
            }

            q.exec(function (err, document) {
                // store the populated document in the refDoc
                refDoc.doc = document;
                return done(err);
            });

        }, function (err, results) {
            return donePopulating(err);
        });
    }

    function _populateIdea(donePopulating) {
        if (socialInteraction.idea) {
            mongoose.model('Idea')
                .findById(socialInteraction.idea)
                .select(mongoose.model('Idea').getI18nPropertySelector(locale))
                .exec(function (err, idea) {
                    if (err) {
                        return donePopulating(err);
                    }

                    // using doc.setValue here because of this:
                    // manually setting a property of type "ref -> Document" to an actual document does not
                    // work currently, only allows setting to ObjectID. This is being changed in Mongoose,
                    //
                    // https://github.com/LearnBoost/mongoose/issues/2370

                    socialInteraction.setValue('idea', idea);

                    if (campaignId) {

                        // calculate the count this idea has been planned within the campaign
                        Activity.count({
                            idea: idea._id,
                            campaign: campaignId
                        }).exec(function (err, count) {
                            if (err) {
                                return donePopulating(err);
                            }
                            log.debug({count: count}, 'plan Count');
                            socialInteraction.planCount = count;
                            return donePopulating();
                        });
                    } else {
                        return donePopulating();
                    }
                });
        } else {
            return donePopulating();
        }
    }

    function _populateActivity(donePopulating) {
        if (socialInteraction.activity) {
            mongoose.model('Activity')
                .findById(socialInteraction.activity)
                .populate('owner')
                .exec(function (err, activity) {
                    if (err) {
                        return donePopulating(err);
                    }
                    socialInteraction.setValue('activity', activity);
                    return donePopulating();
                });
        } else {
            return donePopulating();
        }

    }

    var ops = [];
    if (_.contains(attrToPopulate, 'idea')) {
        ops.push(_populateIdea);
    }
    if (_.contains(attrToPopulate, 'activity')) {
        ops.push(_populateActivity);
    }
    if (_.contains(attrToPopulate, 'refDocs')) {
        ops.push(_populateRefDocs);
    }

    // for now we populate targetedUsers by default
    ops.push(_populateTargetedUsers);


    async.parallel(ops, function (err) {
        return cb(err, socialInteraction);
    });

}

SocialInteraction.getById = function (idAsString, Model, queryOptions, locale, cb) {
    var query = Model.findById(new mongoose.Types.ObjectId(idAsString));

    var attrsToPopulateManually = _extractManualPopulate(queryOptions);

    generic.processDbQueryOptions(queryOptions, query, Model, locale)
        .exec(function(err, socialInteraction) {

            if (err) {
                return error.handleError(err, cb);
            }
            if (!socialInteraction) {
                return cb(new error.ResourceNotFoundError());
            }
            return _populateSocialInteraction(socialInteraction, null, locale, attrsToPopulateManually, cb);
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
 *
 * @param user the user for who the sois are loaded
 * @param model the soi-model to use, can be SocialInteration or one of it subclasses
 * @param options
 * @param cb
 */
SocialInteraction.getAllForUser = function (user, model, options, cb) {

    log.trace('SocialInteraction.getAllForUser', {user: user, model: model, options: options});

    var adminMode = options.mode === 'admin';
    var locale = options && options.locale;
    var locals = {};
    options.queryOptions = options.queryOptions || {};

    function _loadSocialInteractionDismissed(done) {
        SocialInteractionDismissedModel.find({ user: user._id }, function (err, dismissals) {

            if (err) {
                return done(err);
            }

            // needed to set the dismissalReason of a socialInteraction
            locals.socialInteractionDismissed = dismissals;

            if (options.dismissed && options.dismissalReason) {
                // all dismissed si's except the ones with the specified reason
                locals.dismissedSocialInteractions = _.map(_.filter(dismissals, function (sid) {
                    return sid.reason !== options.dismissalReason;
                }), 'socialInteraction');
            } else {
                locals.dismissedSocialInteractions = _.map(dismissals, 'socialInteraction');
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
        log.trace('SocialInteraction.getAllForUser: found sois: ' + socialInteractions.length, socialInteractions);

        function _populateDismissedStatus() {

            if (options.dismissed) {
                _.forEach(socialInteractions, function (si) {
                    var sid = _.find(locals.socialInteractionDismissed, function (dsi) {
                        return si._id.equals(dsi.socialInteraction);
                    });
                    if (sid) {
                        si.dismissed = true;
                        si.dismissalReason = sid.reason;
                    }
                });
            }
        }

        function _populateRejectedStatus() {
            if (options.rejected) {

                _.forEach(socialInteractions, function (si) {
                    si.rejected = _.any(user.profile.prefs.rejectedIdeas, function (rejectedIdeaObj) {
                        var _id = si.idea._id || si.idea;
                        return rejectedIdeaObj.idea.toString() === _id.toString();
                    });
                });
            }
        }

        var manualPopulation = options.populateManually && options.populateManually.length > 0;
        if (manualPopulation) {
            return async.each(socialInteractions, function (si, done) {
                _populateSocialInteraction(si, null, locale, options.populateManually, done);
            }, function (err) {
                if (err) {
                    return cb(err);
                }
                _populateDismissedStatus();
                _populateRejectedStatus();
                return cb(err, socialInteractions);
            });
        } else {
            _populateDismissedStatus();
            _populateRejectedStatus();
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

                if (options.publishFrom) {
                    var publishFrom = (typeof options.publishFrom === 'boolean') ? now : moment(options.publishFrom).toDate();
                    dbQuery
                        .and({$or: [
                            {publishFrom: {$exists: false}},
                            {publishFrom: {$lte: publishFrom}}
                        ]});
                }
                if (options.publishTo) {
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

                    // filter out invitations the user already participates in only if he does not want the stuff he has
                    // authored himself
                    dbQuery.and({$or: [
                        {
                            __t: { $ne: 'Invitation' }
                        },
                        {
                            activity: {
                                $nin: locals.activityIds
                            }
                        }
                    ]
                    });
                }

                if (options.discriminators) {
                    dbQuery.and({ __t: { $in: options.discriminators } });
                }
                if (options.refDocId) {
                    dbQuery.and({$or: [
                        {refDocs: {$elemMatch: {
                            docId: options.refDocId
                        }}},
                        {activity: options.refDocId},
                        {idea: options.refDocId}
                    ]});
                }

                if (user.profile.language) {
                    dbQuery.and({ $or: [
                        {language: {$exists: false}},
                        {language: user.profile.language}
                    ] });
                }

                // if used model is the parent (SocialInteraction), then the mongoose population mechanism does not work
                // for properties, that only exist on children (.idea, .activity) because the population code in mongoose
                // is not aware of the polymorphism. Therefore we need to take special action here.
                // 1. remove those attributes from the queryOptions.populate, so the default mongoose population does not mess up.
                // 2. store them in the 'populateManually' so we can process them manually later
                options.populateManually = _extractManualPopulate(options.queryOptions);

                generic.processDbQueryOptions(options.queryOptions, dbQuery, model, locale)
                    .exec(_soiLoadCb);
            }
        );
    }

    function _loadAdminMode() {
        var dbQuery = model.find();
        generic.processDbQueryOptions(options.queryOptions || {}, dbQuery, model, locale)
            .exec(_soiLoadCb);
    }

    if (adminMode) {
        _loadAdminMode();
    } else {
        _loadUserMode();
    }
};

SocialInteraction.getInvitationStatus = function (activityId, cb) {

    Activity.findById(activityId, function (err, activity) {

        Invitation.find({ activity: activity._id }).exec(function (err, invitations) {
            if (err) {
                return cb(err);
            }

            SocialInteractionDismissedModel.find({ socialInteraction: { $in: _.map(invitations, '_id') }}).exec(function (err, sidList) {
                if (err) {
                    return cb(err);
                }

                // using an object keyed by user.id to ensure we only have one entry per user
                // when a user has multiple invitations and then joins we have multiple dismissed invs afterwords
                // but a user either joins or not, so only one answer per user. Last one wins, until we need a smarter
                // algo...
                var userResults = {};
                var emailResults = {};

                _.each(invitations, function (invitation) {


                    _.each(_.filter(invitation.targetSpaces, 'type', 'email'), function (space) {

                        var emailResult = {
                            email: space.targetValue,
                            status: 'pending'
                        };
                        emailResults[emailResult.email] = emailResult;
                    });

                    // find all personal pending invitations not yet dismissed
                    _.each(_.filter(invitation.targetSpaces, 'type', 'user'), function (space) {
                        var sid = _.find(sidList, function(sid) {
                            return sid.socialInteraction.equals(invitation._id) && space.targetId.equals(sid.user);
                        });

                        if (!sid) {
                            var userResult = {
                                user: space.targetId,
                                status: 'pending'
                            };
                            userResults[userResult.user] = userResult;
                        }
                    });

                });

                // add all dismissed invitations, including non-personal
                _.each(sidList, function (sid) {
                    var userResult = {
                        user: sid.user,
                        status: sid.reason
                    };
                    userResults[userResult.user] = userResult;
                });

                userResults = _.values(userResults);

                mongoose.model('User').populate(userResults, {path: 'user', model: 'User'}, function (err, userResults) {
                    cb(err, userResults.concat(_.values(emailResults)));
                });
            });
        });
    });

};

function _extractManualPopulate(queryOptions) {
    var normalizedAttrs = _normalizePopulationAttrs(queryOptions.populate);

    var populateAuto = [];
    var populateManually =  [];

    _.forEach(normalizedAttrs, function (attrToPopulate) {
        if (attrToPopulate === 'idea') {
            populateManually.push('idea');
        } else if (attrToPopulate === 'activity') {
            populateManually.push('activity');
        } else if (attrToPopulate === 'refDocs') {
            populateManually.push('refDocs');
        } else {
            populateAuto.push(attrToPopulate);
        }
    });

   queryOptions.populate = populateAuto;
   return populateManually;
}


function _normalizePopulationAttrs(stringOrArray) {
    var output = [];

    function _splitString(string) {
        output = output.concat(string.split(' '));
    }

    if (_.isArray(stringOrArray)) {
        _.forEach(stringOrArray, _splitString);
    } else if (_.isString(stringOrArray)) {
        _splitString(stringOrArray);
    } else if (_.isUndefined(stringOrArray) || _.isNull(stringOrArray)) {
        // do nothing;
    } else {
        throw new Error("unexpected type" + stringOrArray);
    }

    return output;
}

module.exports = SocialInteraction;
