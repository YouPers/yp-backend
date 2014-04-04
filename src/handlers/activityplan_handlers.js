var calendar = require('../util/calendar'),
    mongoose = require('mongoose'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    Activity = mongoose.model('Activity'),
    ActivityOffer = mongoose.model('ActivityOffer'),
    Comment = mongoose.model('Comment'),
    generic = require('./generic'),
    error = require('../util/error'),
    _ = require('lodash'),
    email = require('../util/email'),
    moment = require('moment'),
    async = require('async'),
    auth = require('../util/auth'),
    handlerUtils = require('./handlerUtils');


function generateEventsForPlan(plan, user, i18n) {

    // ToDo: has to be enhanced with functionality to generate only future events for a puts (additional from date as parameter)

    var myIcalObj = calendar.getIcalObject(plan, user, 'eventsGenerationOnly', i18n);

    var duration = moment(plan.mainEvent.end).diff(plan.mainEvent.start);
    var rrule = myIcalObj.events()[0].rrule();

    plan.events = [];
    // if recurring event
    if (rrule) {
        var occurrances = rrule.nextOccurences(moment(plan.mainEvent.start).subtract('day', 1).toDate(), 100);
        _.forEach(occurrances, function (instance) {
            plan.events.push({
                status: 'open',
                begin: instance,
                end: moment(instance).add('ms', duration)
            });
        });
    } else {
        // single date event
        plan.events.push({
            status: 'open',
            begin: plan.mainEvent.start,
            end: plan.mainEvent.end
        });
    }
    return plan;
}

/**
 * handles a PUT request to /ActivityPlan/:planId/event/:eventId.
 * Expects that the ActivityPlan and the event with the corresponding Id exists. Only allows the owning user
 * of the ActivityPlan to update the ActivityEvent.
 * Handles one or more new comments in the ActivityEvent. A comment is considered "new" when there is no id.
 * Comment.author is overwritten by the currently logged in user.
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function putActivityEvent(req, res, next) {

    if (!req.params.planId) {
        return next(new error.MissingParameterError({ required: 'planId' }));
    }

    ActivityPlan
        .findById(req.params.planId).populate('activity')
        .exec(function (err, planFromDb) {
            if (err) {
                return error.handleError(err, next);
            }

            if (!planFromDb) {
                return next(new error.ResourceNotFoundError('ActivityPlan not found', { id: req.params.planId }));
            }

            // TODO: (rblu) check whether new owner is same als old owner???
            if (!planFromDb.owner || !planFromDb.owner.equals(req.user.id)) {
                return next(new error.NotAuthorizedError('The user is not authorized to update this plan.', {
                    userId: req.user.id,
                    activityPlanId: planFromDb.id,
                    owner: planFromDb.owner
                }));
            }

            var eventFromDb = _.find(planFromDb.events, {'id': req.params.eventId});
            if (!eventFromDb) {
                return next(new error.ResourceNotFoundError('Event not found in ActivityPlan', {
                    eventId: req.params.eventId,
                    activityPlanId: req.params.planId
                }));
            }

            var eventToPut = req.body;

            handlerUtils.clean(mongoose.model('ActivityPlanEvent'), eventToPut);

            // checkForNewComments, if there are any comments without id they need to be saved separatly to
            // the comments collection
            var newComments;
            if (eventToPut.comments && Array.isArray(eventToPut.comments) && eventToPut.comments.length > 0) {
                // some comments posted, check if any of them are new (i.e. do not have an id)
                newComments = _.select(eventToPut.comments, function (comment) {
                    return !comment.id;
                });
            }

            delete eventToPut.comments;
            _.extend(eventFromDb, eventToPut);

            var saveCallback = function (err, savedActivityPlan) {
                if (err) {
                    return error.handleError(err, next);
                }

                ActivityPlan.findById(savedActivityPlan._id, function (err, reloadedPlan) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    var savedEvent = _.find(reloadedPlan.events, {'id': req.params.eventId});
                    res.send(200, savedEvent);
                    return next();
                });
            };

            // set plan status to 'old' if no more events are 'open'
            if (planFromDb.status === 'active' && !_.any(planFromDb.events, {status: 'open'})) {
                planFromDb.status = 'old';
            }

            if (newComments && newComments.length > 0) {
                newComments.forEach(function (comment) {
                    comment.refDoc = planFromDb.masterPlan || req.params.planId;
                    comment.refDocModel = 'ActivityPlan';
                    // TODO: (RBLU) in case of slave documents, this might not be the correct path. Need to think about where the comment really belongs...,
                    // might have to point to the corresponding master event id
                    comment.refDocPath = 'events.' + req.params.eventId;
                    comment.author = req.user.id;
                    if (!comment.created) {
                        comment.created = new Date();
                    }
                });
                Comment.create(newComments, function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    // the callbackFn is called with an optional argument for each created comment
                    // we use this to set the ids of the created comments to the updated event
                    req.log.trace({arguments: arguments}, "Arguments of comments creation");
                    for (var i = 1; i < arguments.length; i++) {
                        eventFromDb.comments.push(arguments[i].id);
                    }
                    planFromDb.save(saveCallback);
                });
            } else {
                planFromDb.save(saveCallback);
            }
        });
}

/**
 * handles a POST request to /ActivityPlan
 * generates all the ActivityEvents according to the planning options in the plan.
 *
 * @param req
 * @param res
 * @param next
 */
function postNewActivityPlan(req, res, next) {
    var sentPlan = req.body;

    var err = handlerUtils.checkWritingPreCond(sentPlan, req.user, ActivityPlan);
    if (err) {
        return error.handleError(err, next);
    }

    // check whether delivered owner is the authenticated user
    if (sentPlan.owner && (req.user.id !== sentPlan.owner)) {
        return next(new error.NotAuthorizedError({
            userId: req.user.id,
            owner: sentPlan.owner
        }));
    }

    // if no owner delivered set to authenticated user
    if (!sentPlan.owner) {
        sentPlan.owner = req.user.id;
    }

    // set the campaign that this Plan is part of if it has not been set by the client
    if (!sentPlan.campaign && req.user.campaign) {
        sentPlan.campaign = req.user.campaign.id || req.user.campaign; // allow populated and unpopulated campaign
    }

    req.log.trace({MainEvent: sentPlan.mainEvent}, 'before generating events');
    if (!sentPlan.mainEvent) {
        return next(new error.MissingParameterError({ required: 'mainEvent' }));
    }

    var newActPlan = new ActivityPlan(sentPlan);

    generateEventsForPlan(newActPlan, req.user, req.i18n);
    req.log.trace({eventsAfter: newActPlan.events}, 'after generating events');

    saveNewActivityPlan(newActPlan, req.user, req.i18n, generic.writeObjCb(req, res, next));
}

/**
 * save new activity plan with a mongoose obj that already has been validated
 *
 * @param plan - activityPlan obj
 * @param user - user obj
 * @param cb - callback(err, savedPlan)
 * @param i18n
 */
function saveNewActivityPlan(plan, user, i18n, cb) {

    // add fields of activity to the activity plan
    Activity.findById(plan.activity).exec(function (err, foundActivity) {
        if (err) {
            return cb(err);
        }
        plan.fields = foundActivity.fields;

        plan.save(function (err, savedPlan) {
            if (err) {
                return cb(err);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlan.findById(savedPlan._id).populate('activity').exec(function (err, reloadedActPlan) {
                if (err) {
                    return cb(err);
                }

                if (user && user.email && user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(reloadedActPlan, user, 'new', i18n).toString();
                    email.sendCalInvite(user.email, 'new', myIcalString, i18n);
                }

                // check whether this is a public joinable plan, if yes store an corresponding ActivityOffer
                if (_.contains(['public', 'campaign'], reloadedActPlan.visibility) && 'group' === reloadedActPlan.executionType && !reloadedActPlan.masterPlan) {
                    var offer = new ActivityOffer({
                        activity: reloadedActPlan.activity._id,
                        activityPlan: [reloadedActPlan._id],
                        targetCampaign: reloadedActPlan.campaign,
                        recommendedBy: [user._id],
                        type: [reloadedActPlan.source === 'campaign' ? 'campaignActivityPlan' : 'publicActivityPlan'],
                        validTo: reloadedActPlan.events[reloadedActPlan.events.length - 1].end,
                        prio: [reloadedActPlan.source === 'campaign' ? 500 : 1]
                    });
                    offer.save(function (err, savedOffer) {
                        if (err) {
                            return cb(err);
                        }
                        reloadedActPlan.activity = reloadedActPlan.activity._id;
                        return cb(null, reloadedActPlan);
                    });
                } else {
                    reloadedActPlan.activity = reloadedActPlan.activity._id;
                    return cb(null, reloadedActPlan);
                }
            });

        });
    });
}

function postJoinActivityPlanFn(req, res, next) {

    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }

    ActivityPlan.findById(req.params.id).exec(function (err, masterPlan) {

        if (err) {
            return error.handleError(err, next);
        }

        var slavePlan = new ActivityPlan(masterPlan.toJSON());

        slavePlan.id = undefined;
        slavePlan.masterPlan = masterPlan._id;
        slavePlan.joiningUsers = [];
        slavePlan.owner = req.user.id;

        saveNewActivityPlan(slavePlan, req.user, req.i18n, generic.writeObjCb(req, res, next));

    });

}

// TODO: remove this: use ActivityOffers instead!!!
function getJoinOffers(req, res, next) {

    // check whether the required param 'activity' is here and add it to the dbquery
    if (!req.params.activity) {
        return next(new error.MissingParameterError({ required: 'activity' }));
    }

    var dbquery = ActivityPlan.find(
        {activity: req.params.activity,
            executionType: 'group',
            masterPlan: null
        });

    dbquery.where('visibility').ne('private');

    if (req.user.campaign) {
        dbquery.or([
            {campaign: req.user.campaign.id || req.user.campaign},
            {campaign: null, visibility: 'public'}
        ]);
    } else {
        dbquery.and([
            {'campaign': null},
            {'visibility': 'public'}
        ]);
    }

    generic.addStandardQueryOptions(req, dbquery, ActivityPlan);
    dbquery.exec(generic.sendListCb(req, res, next));

}

function postActivityPlanInvite(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({ required: 'email' }));
    }

    // split up the email field, in case we got more than one mail
    var emails;
    if (_.isArray(req.body.email)) {
        emails = req.body.email;
    } else if (req.body.email.indexOf(' ') !== -1) {
        emails = req.body.email.split(' ');
    } else if (req.body.email.indexOf(';') !== -1) {
        emails = req.body.email.split(';');
    } else if (req.body.email.indexOf(',') !== -1) {
        emails = req.body.email.split(',');
    } else {
        emails = [req.body.email];
    }

    var locals = {
    };
    async.series([
        // first load ActivityPlan
        function (done) {
            ActivityPlan.findById(req.params.id)
                .populate('activity')
                .populate('owner')
                .exec(function (err, plan) {
                    if (err) {
                        return done(err);
                    }
                    if (!plan) {
                        return done(new error.ResourceNotFoundError('ActivityPlan not found.', {
                            id: req.params.id
                        }));
                    }
                    locals.plan = plan;
                    return done();
                });
        },
        // for each email try whether we have a user in the Db with this email address and, if yes, load the user
        // to personalize the email
        // then send the invitation mails
        function (done) {
            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUser) {
                            if (err) {
                                return done(err);
                            }

                            // save the corresponding ActivityOffer
                            var actOffer = new ActivityOffer({
                                activity: locals.plan.activity._id,
                                activityPlan: [locals.plan._id],
                                targetCampaign: locals.plan.campaign,
                                targetUser: invitedUser && invitedUser._id,
                                type: ['personalInvitation'],
                                recommendedBy: [req.user._id],
                                validTo: locals.plan.events[locals.plan.events.length - 1].end
                            });

                            actOffer.save(function (err, savedOffer) {
                                if (err) {
                                    error.handleError(err, done);
                                }
                                email.sendActivityPlanInvite(emailaddress, req.user, locals.plan, invitedUser && invitedUser[0], req.i18n);
                                return done();
                            });
                        });
                },
                function (err) {
                    done();
                });
        }
    ], function (err) {
        if (err) {
            return error.handleError(err, next);
        }
        res.send(200);
        return next();
    });
}

function _deleteActivityPlanNoJoiningPlans(activityPlan, user, reason, i18n, done) {

    if (!activityPlan.masterPlan && activityPlan.joiningUsers.length > 0) {
        return done(new error.InvalidArgumentError('this method can only be called with masterplans, ' +
            'that have an empty joiningUsers array or with slaveplans'));
    }
    // we need the owner of the plan to send him a cancellation to his email address
    mongoose.model('User').findById(activityPlan.owner).populate('profile').select('+email +profile').exec(function (err, owner) {
        if (err) {
            return error.handleError(err, done);
        }

        if (!owner) {
            return done(new error.ResourceNotFoundError('ActivityPlan owner not found.', {
                activityPlanId: activityPlan.id,
                owner: activityPlan.owner
            }));
        }

        ////////////////////
        // private functions
        var _sendNotificationCb = function (err) {
            if (err) {
                return error.handleError(err, done);
            }
            if (owner.profile.userPreferences.email.iCalInvites) {
                var myIcalString = calendar.getIcalObject(activityPlan, owner, 'cancel', i18n, reason).toString();
                email.sendCalInvite(owner.email, 'cancel', myIcalString, i18n, reason);
            }

            // remove any offers to join this plan
            ActivityOffer.find({activityPlan: activityPlan._id}).remove().exec(function (err) {
                if (err) {
                    error.handleError(err, done);
                }
                return done();
            });
        };
        ///////////////////

        var _removeCallback = function (err) {
            if (err) {
                return done(err);
            }

            // plan can be deleted if user is systemadmin or if it is his own plan
            if (auth.checkAccess(user, auth.accessLevels.al_systemadmin)) {
                activityPlan.remove(_sendNotificationCb);
            } else if (owner._id.equals(user._id || user)) {

                // check deleteStatus
                if (activityPlan.deleteStatus === ActivityPlan.activityPlanCompletelyDeletable) {
                    activityPlan.remove(_sendNotificationCb);
                } else if (activityPlan.deleteStatus === ActivityPlan.activityPlanOnlyFutureEventsDeletable) {
                    // delete  all future events, set activityPlan to "Done", send cancellations for deleted events
                    var now = new Date();
                    var tempEvents = activityPlan.events.slice();
                    tempEvents.forEach(function (event) {
                        if (event.begin > now && event.end > now) {
                            // start and end date in the future, so delete event and send cancellation
                            activityPlan.events.id(event.id).remove();
                        }
                    });
                    activityPlan.deletionReason = reason;
                    activityPlan.status = "old";
                    activityPlan.save(_sendNotificationCb);
                } else {
                    return done(new error.BadMethodError('This activityPlan cannot be deleted.', {
                        activityPlanId: activityPlan.id,
                        deleteStatus: activityPlan.deleteStatus
                    }));
                }

            } else {
                return done(new error.NotAuthorizedError('The user is not authorized to delete this plan.'));
            }
        };

        function removeSlaveFromMasterPlan(slave, cb) {
            ActivityPlan.findById(slave.masterPlan, function (err, masterPlan) {
                if (err) {
                    return cb(err);
                }
                if (!masterPlan) {
                    return cb(new error.ResourceNotFoundError('MasterPlan not found', {
                        masterPlanId: slave.masterPlan
                    }));
                }
                _.remove(masterPlan.joiningUsers, function (ju) {
                    return ju.equals(slave.owner);
                });
                masterPlan.markModified('joiningUsers');
                masterPlan.save(function (err) {
                    if (err) {
                        return cb(err);
                    }
                    return cb();
                });
            });

        }


        ///////////
        // if this is a slave of a masterPlan we need to remove the owner of the slave plan from the
        // joiningUsers collection of the master
        if (activityPlan.masterPlan) {
            removeSlaveFromMasterPlan(activityPlan, _removeCallback);
        } else {
            return _removeCallback();
        }

    });
}


function deleteActivityPlan(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    var reason = req.params.reason || '';

    ActivityPlan.findById(req.params.id).populate('activity').exec(function (err, activityPlan) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!activityPlan) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found.', {
                id: req.params.id
            }));
        }

        // plan can be deleted if user is systemadmin or if it is his own plan
        if (!( auth.checkAccess(req.user, auth.accessLevels.al_systemadmin) ||
            activityPlan.owner.equals(req.user._id))) {
            return next(new error.NotAuthorizedError());
        }

        // if this is a masterPlan and and we have joined users we need to delete the joingingPlans first:
        // delete the slavePlans and notify them with a calender deletion
        // email. When all slaves are deleted we delete the master.

        var usersWithSlavePlansToDelete = [];
        // we have to check whether this is a masterPlan, only then we have to delete slaves.
        // Reason: If this is a slavePlan, then the owner of the masterPlan is in the joiningUsers-Collection,
        if (!activityPlan.masterPlan) {
            usersWithSlavePlansToDelete = activityPlan.joiningUsers;
        }
        async.forEach(usersWithSlavePlansToDelete, function (joinedUser, done) {
            // we need to load the plan and get the user by populating its owner property
            ActivityPlan.find({masterPlan: activityPlan._id, owner: joinedUser._id || joinedUser})
                .exec(function (err, plans) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    if (!plans || plans.length !== 1) {
                        return done(new error.InvalidArgumentError('0 or more than one slavePlan found for this user: ' + plans.length,
                            {user: joinedUser, masterPlan: activityPlan._id, slavePlans: plans}));
                    }
                    return _deleteActivityPlanNoJoiningPlans(plans[0], joinedUser, reason, req.i18n, done);
                });
        }, function (err) {
            if (err) {
                return error.handleError(err, next);
            }
            // reload the activityPlan to check whether all joiningUsers are gone
            ActivityPlan.findById(activityPlan._id, function (err, reloadedPlan) {
                if (err) {
                    return error.handleError(err, next);
                }
                return _deleteActivityPlanNoJoiningPlans(reloadedPlan, req.user, reason, req.i18n, function (err) {
                    if (err) {
                        return next(err);
                    } else {
                        res.send(200);
                        return next();
                    }
                });
            });
        });
    });
}

function putActivityPlan(req, res, next) {

    var sentPlan = req.body;
    var err = handlerUtils.checkWritingPreCond(sentPlan, req.user, ActivityPlan);
    if (err) {
        error.handleError(err, next);
    }

    ActivityPlan.findById(req.params.id).exec(function (err, loadedActPlan) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!loadedActPlan) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found.', { id: sentPlan.id }));
        }

        // check to see if received plan is editable
        if (loadedActPlan.editStatus !== "editable") {
            var notEditableError = new Error('Error updating in Activity Plan PutFn: Not allowed to update this activity plan with id: ');
            notEditableError.statusCode = 409;
            return next(new error.BadMethodError('This activityPlan cannot be edited.', {
                activityPlanId: sentPlan.id,
                editStatus: loadedActPlan.editStatus
            }));
        }

        if (req.body.mainEvent && !_.isEqual(req.body.mainEvent, loadedActPlan.mainEvent)) {
            generateEventsForPlan(req.body, req.user, req.i18n);
        }

        _.extend(loadedActPlan, req.body);

        req.log.trace(loadedActPlan, 'PutFn: Updating existing Object');

        loadedActPlan.save(function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlan.findById(loadedActPlan._id).populate('activity').exec(function (err, reloadedActPlan) {
                // we read 'activity' so we can get create a nice calendar entry using using the activity title
                if (err) {
                    return error.handleError(err, next);
                }
                if (req.user && req.user.email && req.user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(reloadedActPlan, req.user, 'update', req.i18n).toString();
                    email.sendCalInvite(req.user.email, 'update', myIcalString, req.i18n);
                }

                // remove the populated activity because the client is not gonna expect it to be populated.
                reloadedActPlan.activity = reloadedActPlan.activity._id;
                res.header('location', req.url + '/' + reloadedActPlan._id);
                res.send(201, reloadedActPlan);
                return next();
            });
        });
    });
}

module.exports = {
    postNewActivityPlan: postNewActivityPlan,
    putActivityEvent: putActivityEvent,
    postJoinActivityPlanFn: postJoinActivityPlanFn,
    getJoinOffers: getJoinOffers,
    postActivityPlanInvite: postActivityPlanInvite,
    deleteActivityPlan: deleteActivityPlan,
    putActivityPlan: putActivityPlan
};