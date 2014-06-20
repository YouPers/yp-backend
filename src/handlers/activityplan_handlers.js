var calendar = require('../util/calendar'),
    mongoose = require('mongoose'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    Activity = mongoose.model('Activity'),
    ActivityEvent = mongoose.model('ActivityEvent'),
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

function _getEvents(plan, ownerId, fromDate) {

    var duration = moment(plan.mainEvent.end).diff(plan.mainEvent.start);

    var occurrences = calendar.getOccurrences(plan, fromDate);

    var events = [];

    _.forEach(occurrences, function (instance) {
        events.push({
            status: 'open',
            begin: moment(instance).toDate(),
            end: moment(instance).add('ms', duration).toDate(),
            activityPlan: plan._id,
            activity: plan.activity,
            owner: ownerId
        });
    });

    return events;
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

function getActivityPlanConflicts(req, res, next) {
    var sentPlan = req.body;

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

    // generate all events from the sentPlan to validate -> sentEvents
    var newEvents = _getEvents(sentPlan, req.user.id);

    // load all planned events of this user that:
    //     plannedEvent.begin before the end of the last sentEvent.end
    // AND
    //     .plannedEventend after the begin of the first sentEvent.start
    // only these events can have conflicts

    // TODO: improve performance by only loading plans that possibly conflict. This query here uses the status flag which is good enough to filter all old events.
    // var beginOfFirstNewEvent = newEvents[0].begin;
    // var endOfLastNewEvent = newEvents[newEvents.length-1].end;


    // if the sentPlan has an id, we want to exclude it from the conflicts-search, because this is an editing of a plan
    // and conflicts with itself should not be returned.
    var q = ActivityPlan
        .find({owner: req.user._id, status: 'active'});

    if (sentPlan.id) {
        q.where({$ne: {_id: mongoose.Types.ObjectId(sentPlan.id)}});
    }
    q.exec(function (err, oldPlans) {
        if (err) {
            return error.handleError(err, next);
        }
        var conflicts = [];

        // put the events of the loaded plans in an ordered list by beginDate
        var plannedEvents = [];
        _.forEach(oldPlans, function (plan) {
            _.forEach(plan.events, function (event) {
                // use plain "non-mongoose" object to prevent troubles with serializing the "pseudo attribute" title
                var plainEventObj = event.toObject();
                plainEventObj.title = plan.title;
                delete plainEventObj._id;
                plannedEvents.push(plainEventObj);
            });
        });

        // go over all newEvents:
        //     forEach newEvent:
        //        find all plannedEvents, that have:
        //                     plannedEvent.start < newEvent.end
        //                     AND
        //                     plannedEvent.end > sentEvent.start:
        //                      WE FOUND A CONFLICT

        _.forEach(newEvents, function (newEvent) {
            var conflictingEvent = _.find(plannedEvents, function (plannedEvent) {
                return ((plannedEvent.begin < newEvent.end) && (plannedEvent.end > newEvent.begin));
            });
            if (conflictingEvent) {
                conflicts.push({conflictingNewEvent: newEvent, conflictingSavedEvent: conflictingEvent});
            }
        });

        res.send(conflicts);
        return next();
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

    if (!sentPlan.activity) {
        return next(new error.MissingParameterError('"activity" is a required attribute', { required: 'activity' }));
    }

    if (sentPlan.joiningUsers && sentPlan.joiningUsers.length > 0) {
        return next(new error.InvalidArgumentError('"joiningUsers" has to be emtpy for now plan, use JOIN Api to join an existing plan'));
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

    var events = _getEvents(sentPlan, req.user.id);
    ActivityEvent.create(events, function (err, events) {
        if (err) {
            error.handleError(err, next);
        }

        var newActPlan = new ActivityPlan(sentPlan);
        _saveNewActivityPlan(newActPlan, req, generic.writeObjCb(req, res, next));
    });
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

        if (!foundActivity) {
            return cb(new error.InvalidArgumentError('referenced activity not found', { required: 'activity', activity: plan.activity }));
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
            ActivityPlan.findById(savedPlan._id).populate('activity masterPlan owner').exec(function (err, reloadedActPlan) {
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


function postJoinActivityPlanFn(req, res, next) {

    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }

    ActivityPlan.findById(req.params.id).exec(function (err, masterPlan) {

        if (err) {
            return error.handleError(err, next);
        }

        masterPlan.joiningUsers.push(req.user.id);
        var events = _getEvents(masterPlan, req.user.id);

        ActivityEvent.create(events, function (err, events) {
            if (err) {
                error.handleError(err, next);
            }
            masterPlan.save(generic.writeObjCb(req, res, next));
        });
    });

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
                                    offerType: ['personalInvitation'],
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


function _sendIcalMessages(activityPlan, req, reason, type, done) {
    var users = [activityPlan.owner].concat(activityPlan.joiningUsers);

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, users) {
        async.forEach(users, function (user, next) {
                if (user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(activityPlan, user, type, req.i18n, reason).toString();
                    email.sendCalInvite(user.email, type, myIcalString, activityPlan, req.i18n, reason);
                }
            },
            done);
    });
}
function _deleteFutureEvents(activityPlan, done) {
    var now = new Date();

    ActivityEvent
        .remove({activityPlan: activityPlan._id, begin: {$gte: now}})
        .exec(function (err, count) {
            if (err) {
                return done(err);
            }
            return done(null);
        });
}

function deleteActivityPlan(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    var reason = req.params.reason || 'The organizer Deleted this activity';

    ActivityPlan.findById(req.params.id).populate('activity owner joiningUsers').exec(function (err, activityPlan) {
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
            activityPlan.owner._id.equals(req.user._id))) {
            return next(new error.NotAuthorizedError());
        }


        if (activityPlan.getDeleteStatus === ActivityPlan.notDeletableNoFutureEvents) {
            // if this is not deleteable because of no future events we have in fact
            // nothing to do, we just pretend that we deleted all future events, by doing nothing
            // and signalling success
            actMgr.emit('activity:planDeleted', activityPlan);
            return next();
        }

        function _deleteEvents(done) {
            _deleteFutureEvents(activityPlan, done);
        }

        function _sendCalendarCancelMessages(done) {
            _sendIcalMessages(activityPlan, req, reason, 'cancel', done);
        }

        function _deletePlan(done) {
            if (activityPlan.getDeleteStatus === 'deletable') {
                activityPlan.remove(done);
            } else if (activityPlan.getDeleteStatus === 'deletableOnlyFutureEvents') {
                activityPlan.status = 'old';
                if (activityPlan.mainEvent.frequency !== 'once') {
                    activityPlan.mainEvent.recurrence.endby = new Date();
                    activityPlan.mainEvent.recurrence.after = undefined;
                    activityPlan.save(done);
                } else {
                    throw new Error('should never arrive here, it is not possible to have an "once" plan that has ' +
                        'passed and future events at the same time');
                }
            }
        }

        async.parallel([
                _sendCalendarCancelMessages,
                _deleteEvents,
                _deletePlan
            ],
            function (err) {
                if (err) {
                    error.handleError(err, next);
                }
                actMgr.emit('activity:planDeleted', activityPlan);
                return next();
            });
    });
}




function putActivityPlan(req, res, next) {
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


    ActivityPlan.findById(req.params.id).populate('activity owner joiningUsers').exec(function (err, loadedActPlan) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!loadedActPlan) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found.', { id: sentPlan.id }));
        }

        // check to see if received plan is editable
        if (loadedActPlan.editStatus !== "editable") {
            return next(new error.ConflictError('Error updating in Activity Plan PutFn: Not allowed to edit this activity plan.', {
                activityPlanId: sentPlan.id,
                editStatus: loadedActPlan.editStatus
            }));
        }

        _.extend(loadedActPlan, sentPlan);


        function _savePlan(done) {
            loadedActPlan.save(done);
        }

        function _deleteEventsInFuture(done) {
            if (sentPlan.mainEvent && !_.isEqual(sentPlan.mainEvent, loadedActPlan.mainEvent)) {
                return _deleteFutureEvents(loadedActPlan,done);
            } else {
                return done();
            }
        }

        function _sendCalendarUpdates(done) {
            _sendIcalMessages(loadedActPlan, req, null, 'cancel', done);
        }


        function finalCb(err) {
            if (err) {
                error.handleError(err, next);
            }

            loadedActPlan.activity = loadedActPlan.activity._id;

            actMgr.emit('activity:planUpdated', loadedActPlan);

            res.send(200, loadedActPlan);
            return next();
        }


        function _updateEventsForAllUsers(done) {
            if (sentPlan.mainEvent && !_.isEqual(sentPlan.mainEvent, loadedActPlan.mainEvent)) {
                var users = [loadedActPlan.owner].concat(loadedActPlan.joiningUsers);

                return async.forEach(users, function(user, cb) {
                    var events = _getEvents(loadedActPlan, user._id, new Date());
                    ActivityEvent.create(events, cb);
                }, done);
            } else {
                return done();
            }

        }

        return async.parallel([
                _savePlan,
                _sendCalendarUpdates,
                function(done) {
                    async.series([
                        _deleteEventsInFuture,
                        _updateEventsForAllUsers
                    ], done);
                }
            ],
            finalCb);
    });
}

module.exports = {
    postNewActivityPlan: postNewActivityPlan,
    putActivityEvent: putActivityEvent,
    postJoinActivityPlanFn: postJoinActivityPlanFn,
    postActivityPlanInvite: postActivityPlanInvite,
    deleteActivityPlan: deleteActivityPlan,
    putActivityPlan: putActivityPlan,
    getActivityPlanConflicts: getActivityPlanConflicts
};