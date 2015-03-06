var EventEmitter = require('events').EventEmitter,
    error = require('ypbackendlib').error,
    util = require('util'),
    mongoose = require('ypbackendlib').mongoose,
    User = mongoose.model('User'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    Event = mongoose.model('Event'),
    email = require('../util/email'),
    config = require('../config/config'),
    log = require('ypbackendlib').log(config),
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    i18n = require('ypbackendlib').i18n.initialize(),
    generic = require('ypbackendlib').handlers,
    push = require('ypbackendlib').push(config);


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
    var event = invitation.event;

    // invitations for events
    if (event) {
        Event.findById(event._id || event).populate('idea').exec(function (err, event) {
            if(err) {
                return SocialInteraction.emit('error', err);
            }
            if(!event) {
                return SocialInteraction.emit('error', 'event not found: ' + event._id || event);
            }

            var userIds = _.map(_.filter(invitation.targetSpaces, 'type', 'user'), 'targetId');

            log.debug({userIds: userIds}, 'Invitation:add for these users');

            // get author
            User.findById(invitation.author).exec(function (err, author) {

                if (err) {
                    return log.error({err: err, invitation: invitation}, 'error in evenHandler: invitation:add');
                }
                // get all targeted users
                User.find({ _id: { $in: userIds}}).select('+email +profile').populate('profile').exec(function (err, users) {
                    if (err) {
                        return log.error({err: err, invitation: invitation}, 'error in evenHandler: invitation:add');
                    }

                    _.each(users, function (user) {
                        email.sendEventInvite(user.email, author, event, user, invitation._id, i18n);

                        var pushData = {
                            type: 'newPersonalInvitation',
                            title: 'New Invitation for Event' + event.title ,
                            text: author.fullname +' has invited you to join',
                            event: invitation.event,
                            idea: invitation.idea,
                            author: invitation.author};
                        log.trace({recipient: user.id, data: pushData}, "sending push now");

                        push.sendPush(user, pushData, 'newPersonalInvitation', function (err, result) {
                            if (err) {
                                return SocialInteraction.emit('error', err);
                            }
                            log.info({result: result, user: user.id, data:  pushData}, "sent push notification");
                        });
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
 * store invitations for an event
 *
 * @param from      inviting user / author
 * @param to        single or multiple recipients, can either be email addresses or users
 * @param event  the referenced event
 *
 */
SocialInteraction.on('invitation:event', function (from, to, event) {

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
        idea: event.idea,
        event: event._id,
        publishTo: event.lastEventEnd
    });

    invitation.save(function (err, inv) {

        _.each(inv.targetSpaces, function (space) {

            if (space.type === 'user' || space.type === 'email') {
                var emailAddress = space.type === 'user' ? usersById[space.targetId].email : space.targetValue;
                email.sendEventInvite(emailAddress, from, event, usersById[space.targetId], inv._id, i18n);
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
 * @param event  the referenced campaign
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
 * @param event  the referenced organization
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

SocialInteraction.removeDismissals = function (event, user, cb) {

    Invitation.find({ event: event._id }).exec(function (err, invitations) {
        if (err) {
            return cb(err);
        }

        SocialInteractionDismissedModel.find(
            {
                socialInteraction: {$in: _.map(invitations, '_id')},
                user: user._id
            }
        ).remove(function (err) {
                if (err) {
                    return cb(err);
                }

            });
    });

};

SocialInteraction.deleteSocialInteractions = function (refDoc, cb) {

    var finder =
    {$or: [
        {refDocs: {$elemMatch: {
            docId: refDoc._id || refDoc
        }}},
        {event: refDoc._id || refDoc},
        {idea: refDoc._id || refDoc}
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
 * @param refDoc    the referenced document, one of: Idea, Event, Campaign, ...
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
        {event: refDoc._id || refDoc},
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
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });

        // Model.update does not work with undefined values
        _.each(_.keys(document), function (key) {
            if(_.isUndefined(document[key])) {
                delete document[key];
            }
        });

        // Model.update does not return the updated SID -> findOneAndUpdate
        SocialInteractionDismissedModel.findOneAndUpdate({
            user: userId,
            socialInteraction: socialInteraction.id
        }, document, { upsert: true }, function (err, saved) {
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
 * @param campaignId - optional, needed for the count an event has been planned within a campaign
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
                        Event.count({
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

    function _populateEvent(donePopulating) {
        if (socialInteraction.event) {
            mongoose.model('Event')
                .findById(socialInteraction.event)
                .populate('owner')
                .exec(function (err, event) {
                    if (err) {
                        return donePopulating(err);
                    }
                    socialInteraction.setValue('event', event);
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
    if (_.contains(attrToPopulate, 'event')) {
        ops.push(_populateEvent);
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

    log.debug('SocialInteraction.getAllForUser', {user: user.fullname, model: model.modelName, options: options});

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

    function _loadEvents(done) {
        mongoose.model('Event').find({ $or: [
            { owner: user._id },
            { joiningUsers: user._id }
        ]}, function (err, events) {
            if (err) {
                return done(err);
            }
            locals.eventIds = _.map(events, '_id');
            return done();
        });
    }

    function _soiLoadCb(err, socialInteractions) {
        if (err) {
            return cb(err);
        }
        log.debug({number: socialInteractions.length}, 'SocialInteraction.getAllForUser: executed');

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
        async.parallel([_loadSocialInteractionDismissed, _loadEvents],
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
                            {type: 'event'},
                            {targetId: {$in: locals.eventIds}}
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
                            event: {
                                $nin: locals.eventIds
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
                        {event: options.refDocId},
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
                // for properties, that only exist on children (.idea, .event) because the population code in mongoose
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

SocialInteraction.getInvitationStatus = function (eventId, cb) {

    Event.findById(eventId, function(err, event) {

        Invitation.find({ event: event._id }).exec(function (err, invitations) {
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


                    _.each(_.filter(invitation.targetSpaces, 'type', 'email'), function (space) {

                        var emailResult = {
                            email: space.targetValue,
                            status: 'pending'
                        };
                        emailResults.push(emailResult);
                    });

                    // find all personal pending invitations not yet dismissed
                    _.each(_.filter(invitation.targetSpaces, 'type','user'), function (space) {
                        var sid = _.find(sidList, { socialInteraction: invitation._id, user: space.targetId });

                        if (!sid) {
                            var userResult = {
                                user: space.targetId,
                                status: 'pending'
                            };
                            userResults.push(userResult);
                        }
                    });

                });

                // add all dismissed invitations, including non-personal
                _.each(sidList, function (sid) {
                    var userResult = {
                        user: sid.user,
                        status: sid.reason
                    };
                    userResults.push(userResult);
                });

                mongoose.model('User').populate(userResults, {path: 'user', model: 'User'}, function (err, userResults) {
                    cb(err, userResults.concat(emailResults));
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
        } else if (attrToPopulate === 'event') {
            populateManually.push('event');
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


SocialInteraction.createNewInvitation = function createNewInvitation(invitor, event, usersToInvite, cb) {
    var isPersonal = usersToInvite && usersToInvite.length > 0;

    var invitation  = {
        author: invitor._id,
        event: event._id,
        idea:  event.idea,
        authorType: 'user',
        __t: 'Invitation',
        publishFrom: new Date(),
        publishTo: event.end
    };

    if (!invitation.idea) {
        throw new Error("no idea on new invitation");
    }

    invitation.targetSpaces = [];
    if (isPersonal) {
        _.forEach(usersToInvite, function (userId) {
            invitation.targetSpaces.push({
                type: 'user',
                targetId: userId
            });
        });
    } else {
       invitation.targetSpaces.push({
            type: 'campaign',
            targetId: event.campaign
        });
    }

    var newInvitationDoc = new Invitation(invitation);

    return newInvitationDoc.save(cb);
};

SocialInteraction.createNewPublicInvitation = function createNewPublicInvitation(invitor, event, cb) {
    SocialInteraction.createNewInvitation(invitor, event, null, cb);
};

SocialInteraction.createNewPersonalInvitation = function createNewPersonalInvitation(invitor, event, usersToInvite, cb) {
    SocialInteraction.createNewInvitation(invitor, event, usersToInvite, cb);
};

module.exports = SocialInteraction;
