var calendar = require('../util/calendar'),
    mongoose = require('mongoose'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    Activity = mongoose.model('Activity'),
    ActivityOffer = mongoose.model('ActivityOffer'),
    actMgr = require('../core/ActivityManagement'),
    generic = require('./generic'),
    error = require('../util/error'),
    _ = require('lodash'),
    email = require('../util/email'),
    moment = require('moment'),
    async = require('async'),
    auth = require('../util/auth'),
    handlerUtils = require('./handlerUtils'),
    Diary = require('../core/Diary');

function _generateEventsForPlan(plan, user, i18n, planToUpdate) {

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

    // if we generate because we are updating an existing plan, we are only interested in the future events, BUT we
    // need to keep the passed events of the planToUpdate (there is the information whether the user done/missed/open the
    // passed events
    if (planToUpdate) {
        _replacePassedEvents(plan, planToUpdate);
    }
    return plan;
}

/**
 * handles a PUT request to /ActivityPlan/:planId/event/:eventId.
 * Expects that the ActivityPlan and the event with the corresponding Id exists. Only allows the owning user
 * of the ActivityPlan to update the ActivityEvent.
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

            _.extend(eventFromDb, eventToPut);

            // set plan status to 'old' if no more events are 'open'
            if (planFromDb.status === 'active' && !_.any(planFromDb.events, {status: 'open'})) {
                planFromDb.status = 'old';
            }

            var diaryEntry = {
                owner: planFromDb.owner,
                type: 'activityPlanEvent',
                refId: eventFromDb._id,
                image: planFromDb.activity.getPictureUrl(),
                title: planFromDb.title,
                text: eventFromDb.comment,
                feedback: eventFromDb.feedback,
                dateBegin: eventFromDb.begin,
                dateEnd: eventFromDb.end
            };

            Diary.createOrUpdateDiaryEntry(diaryEntry, function (err) {
                if (err) {
                    return error.handleError(err, next);
                }
                planFromDb.save(saveCallback);
            });


            function saveCallback(err, savedActivityPlan) {
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

    // check required Attributes
    if (!sentPlan.mainEvent) {
        return next(new error.MissingParameterError({ required: 'mainEvent' }));
    }

    if (!sentPlan.mainEvent.start) {
        return next(new error.MissingParameterError({ required: 'mainEvent.start' }));
    }
    if (!sentPlan.mainEvent.end) {
        return next(new error.MissingParameterError({ required: 'mainEvent.end' }));
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

    _generateEventsForPlan(newActPlan, req.user, req.i18n);
    req.log.trace({eventsAfter: newActPlan.events}, 'after generating events');

    _saveNewActivityPlan(newActPlan, req, generic.writeObjCb(req, res, next));
}

/**
 * save new activity plan with a mongoose obj that already has been validated
 *
 * @param plan - activityPlan obj
 * @param req - the request
 * @param cb - callback(err, savedPlan)
 */
function _saveNewActivityPlan(plan, req, cb) {
    var user = req.user;
    var i18n = req.i18n;

    // add fields of activity to the activity plan
    Activity.findById(plan.activity).exec(function (err, foundActivity) {
        if (err) {
            return cb(err);
        }
        plan.fields = foundActivity.fields;

        if (!plan.title) {
            plan.title = foundActivity.title;
        }

        plan.save(function (err, savedPlan) {
            if (err) {
                return cb(err);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlan.findById(savedPlan._id).populate('activity masterPlan').exec(function (err, reloadedActPlan) {
                if (err) {
                    return cb(err);
                }

                if (user && user.email && user.profile.userPreferences.email.iCalInvites) {
                    req.log.debug({start: reloadedActPlan.mainEvent.start, end: reloadedActPlan.mainEvent.end}, 'Saved New Plan');
                    var myIcalString = calendar.getIcalObject(reloadedActPlan, user, 'new', i18n).toString();
                    email.sendCalInvite(user.email, 'new', myIcalString, reloadedActPlan, i18n);
                }

                actMgr.emit('activity:planSaved', reloadedActPlan);

                // remove the populated activity and masterplan because the client is not gonna expect it to be populated.
                reloadedActPlan.activity = reloadedActPlan.activity._id;
                if (reloadedActPlan.masterPlan) {
                    reloadedActPlan.masterPlan = reloadedActPlan.masterPlan._id;
                }

                return cb(null, reloadedActPlan);

            });

        });
    });
}

/**
 * deletes all passed events from the newPlan and replaces them with the passedEvents from the oldPlan.
 * mutates the new Plan
 * @param newPlan
 * @param oldPlan
 * @private
 */
function _replacePassedEvents(newPlan, oldPlan) {
    var now = new Date();
    // remove all passed events from the newPlan
    _.remove(newPlan.events, function (event) {
        return event.end < now;
    });

    // add all passed events from the oldPlan
    _.forEach(oldPlan.events, function (event) {
        if (event.end < now) {
            newPlan.events.unshift(event);
        }
    });
    return newPlan;
}

/**
 * deletes all future events from the targetPlan and replaces them with the futureEvents from the sourcePlan.
 * mutates the new Plan
 * @param targetPlan
 * @param sourcePlan
 * @private
 */
function _replaceFutureEvents(targetPlan, sourcePlan) {
    var now = new Date();

    // remove all future events from the targetPlan
    var eventsToRemove = _.filter(targetPlan.events, function (event) {
        return event.end > now;
    });
    _.forEach(eventsToRemove, function(event){
        event.remove();
    });

    // add all future events from the sourcePlan
    _.forEach(sourcePlan.events, function (event) {
        if (event.end > now) {
            targetPlan.events.push(event);
        }
    });
    return targetPlan;
}

/**
 * creates a slavePlan from a masterPlan for a given targetUser that is about to Join the MasterPlan
 * If no slavePlanToUpdate is given, the returned slavePlan is a copy of the masterplan without an ObjectId.
 *
 * If a slavePlanToUpdate is passed, then we replace all passed events from the masterPlan with the
 * passed events from the slavePlanToUpdate to preserve the history of the slaveUser.
 *
 * @param masterPlan
 * @param targetUser
 * @param slavePlanToUpdate
 * @returns {ActivityPlan}
 * @private
 */
function _createSlaveFromMaster(masterPlan, targetUser, slavePlanToUpdate) {
    if (slavePlanToUpdate) {
        slavePlanToUpdate.mainEvent = masterPlan.mainEvent;
        slavePlanToUpdate.title = masterPlan.title;
        slavePlanToUpdate.location = masterPlan.location;
        _replaceFutureEvents(slavePlanToUpdate, masterPlan);
        return slavePlanToUpdate;
    } else {
        var slavePlan = new ActivityPlan(masterPlan.toJSON());
        slavePlan.id = undefined;
        slavePlan.masterPlan = masterPlan._id;
        slavePlan.joiningUsers = [];
        slavePlan.owner = targetUser.id;
        slavePlan.source = 'community';
        if (!slavePlan.activity) {
            slavePlan.activity = masterPlan.activity._id || masterPlan.activity;
        }
        return slavePlan;
    }


}

function postJoinActivityPlanFn(req, res, next) {

    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }

    ActivityPlan.findById(req.params.id).exec(function (err, masterPlan) {

        if (err) {
            return error.handleError(err, next);
        }

        var slavePlan = _createSlaveFromMaster(masterPlan, req.user);

        _saveNewActivityPlan(slavePlan, req, generic.writeObjCb(req, res, next));

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

                            // if this is an existing user, we create an offer and a notification
                            // if NOT, we just send the email
                            if (invitedUser && invitedUser.length === 1) {
                                // save the corresponding ActivityOffer
                                var actOffer = new ActivityOffer({
                                    activity: locals.plan.activity._id,
                                    activityPlan: [locals.plan._id],
                                    targetQueue: invitedUser[0] && invitedUser[0]._id,
                                    type: ['personalInvitation'],
                                    recommendedBy: [req.user._id],
                                    validTo: locals.plan.events[locals.plan.events.length - 1].end
                                });

                                actOffer.save(function (err, savedOffer) {
                                    if (err) {
                                        return error.handleError(err, done);
                                    }
                                    actMgr.emit('activity:offerSaved', savedOffer, locals.plan);
                                    _offerSavedCb(null);
                                });
                            } else {
                                process.nextTick(_offerSavedCb);
                            }

                            function _offerSavedCb(err) {
                                if (err) {
                                    return error.handleError(err, done);
                                }
                                email.sendActivityPlanInvite(emailaddress, req.user, locals.plan, invitedUser && invitedUser[0], req.i18n);
                                return done();
                            }
                        });
                },
                function (err) {
                    if (err) {
                        return error.handleError(err, done);
                    }
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
        var _sendCalenderCancelCb = function (err) {
            if (err) {
                return error.handleError(err, done);
            }
            if (owner.profile.userPreferences.email.iCalInvites) {
                var myIcalString = calendar.getIcalObject(activityPlan, owner, 'cancel', i18n, reason).toString();
                email.sendCalInvite(owner.email, 'cancel', myIcalString, activityPlan, i18n, reason);
            }
            actMgr.emit('activity:planDeleted', activityPlan);
            return done();
        };
        ///////////////////

        var _removeCallback = function (err) {
            if (err) {
                return done(err);
            }

            // plan can be deleted if user is systemadmin or if it is his own plan
            if (auth.checkAccess(user, auth.accessLevels.al_systemadmin)) {
                activityPlan.remove(_sendCalenderCancelCb);
            } else if (owner._id.equals(user._id || user)) {

                // check deleteStatus
                if (activityPlan.deleteStatus === ActivityPlan.activityPlanCompletelyDeletable) {
                    activityPlan.remove(_sendCalenderCancelCb);
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
                    activityPlan.save(_sendCalenderCancelCb);
                } else if (activityPlan.deleteStatus === ActivityPlan.notDeletableNoFutureEvents) {
                    // if this is not deleteable because of no future events we have in fact
                    // nothing to do, we just pretend that we deleted all future events, by doing nothing
                    // and signalling success
                    _sendCalenderCancelCb(null);
                } else {
                    return done(new error.ConflictError('This activityPlan cannot be deleted.', {
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


function _updateSlavePlans(updatedMasterPlan, req, cb) {

    ActivityPlan
        .find({masterPlan: updatedMasterPlan._id})
        .populate('owner', '+profile +email')
        .exec(function (err, slavePlansToUpdate) {
            if (err) {
                return error.handleError(err, cb);
            }
            async.forEach(slavePlansToUpdate,
                function (slavePlan, done) {

                    var slaveUser = slavePlan.owner;
                    var newSlavePlan = _createSlaveFromMaster(updatedMasterPlan, slaveUser, slavePlan);

                    // depopulate newSlavePlan.activity if needed before saving
                    if (newSlavePlan.activity._id) {
                        newSlavePlan.activity = newSlavePlan.activity._id;
                    }
                    newSlavePlan.save(function (err, savedSlavePlan) {
                        if (err) {
                            return done(err);
                        }
                        mongoose.model('Profile').populate(slaveUser, 'profile', function () {
                            if (slaveUser && slaveUser.email && slaveUser.profile.userPreferences.email.iCalInvites) {
                                req.log.debug({start: savedSlavePlan.mainEvent.start, end: savedSlavePlan.mainEvent.end}, 'Updated Slave Plan');
                                var myIcalString = calendar.getIcalObject(updatedMasterPlan, slaveUser, 'update', req.i18n).toString();
                                email.sendCalInvite(slaveUser.email, 'update', myIcalString, savedSlavePlan, req.i18n);
                            }
                            return done();
                        });

                    });
                }, cb);

        });
}

function putActivityPlan(req, res, next) {

    // TODO: handle updates of offers validFrom/validTo and notifications publishFrom/publishTo

    var sentPlan = req.body;
    var err = handlerUtils.checkWritingPreCond(sentPlan, req.user, ActivityPlan);
    if (err) {
        error.handleError(err, next);
    }

    // check required Attributes, if we get a main event, at least from and to must be set
    if (sentPlan.mainEvent) {
        if (!sentPlan.mainEvent.start) {
            return next(new error.MissingParameterError({ required: 'mainEvent.start' }));
        }
        if (!sentPlan.mainEvent.end) {
            return next(new error.MissingParameterError({ required: 'mainEvent.end' }));
        }
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
            return next(new error.ConflictError('Error updating in Activity Plan PutFn: Not allowed to update this activity plan.', {
                activityPlanId: sentPlan.id,
                editStatus: loadedActPlan.editStatus
            }));
        }

        if (sentPlan.mainEvent && !_.isEqual(sentPlan.mainEvent, loadedActPlan.mainEvent)) {
            _generateEventsForPlan(sentPlan, req.user, req.i18n, loadedActPlan);
        }

        _.extend(loadedActPlan, req.body);

        loadedActPlan.save(function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlan.findById(loadedActPlan._id).populate('activity masterPlan').exec(function (err, reloadedActPlan) {
                if (err) {
                    return error.handleError(err, next);
                }
                req.log.debug({start: reloadedActPlan.mainEvent.start, end: reloadedActPlan.mainEvent.end}, 'Saved Edited Plan');
                if (err) {
                    return error.handleError(err, next);
                }
                // sending the owner of the plan an updateEmail
                if (req.user && req.user.email && req.user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(reloadedActPlan, req.user, 'update', req.i18n).toString();
                    email.sendCalInvite(req.user.email, 'update', myIcalString, reloadedActPlan, req.i18n);
                }

                // remove the populated activity  because the client and the follwoing code is not gonna expect it to be populated.
                reloadedActPlan.activity = reloadedActPlan.activity._id;

                // if this is a masterPlan and we have joinginUsers we need to update the slaves
                if (!reloadedActPlan.masterPlan && reloadedActPlan.joiningUsers.length > 0) {
                    return _updateSlavePlans(reloadedActPlan, req, _sendUpdateCb);
                } else {
                    return _sendUpdateCb(null);
                }

                function _sendUpdateCb(err) {
                    if (err) {
                        error.handleError(err, next);
                    }

                    if (reloadedActPlan.masterPlan) {
                        reloadedActPlan.masterPlan = reloadedActPlan.masterPlan._id;
                    }

                    res.header('location', req.url + '/' + reloadedActPlan._id);

                    res.send(200, reloadedActPlan);
                    return next();
                }
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