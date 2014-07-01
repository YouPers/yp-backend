var calendar = require('../util/calendar'),
    mongoose = require('mongoose'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    Idea = mongoose.model('Idea'),
    ActivityEvent = mongoose.model('ActivityEvent'),
    actMgr = require('../core/ActivityManagement'),
    SocialInteraction = require('../core/SocialInteraction'),
    generic = require('./generic'),
    error = require('../util/error'),
    _ = require('lodash'),
    email = require('../util/email'),
    moment = require('moment'),
    async = require('async'),
    auth = require('../util/auth'),
    handlerUtils = require('./handlerUtils');

function _getEvents(plan, ownerId, fromDate) {

    var duration = moment(plan.mainEvent.end).diff(plan.mainEvent.start);

    var occurrences = calendar.getOccurrences(plan, fromDate);

    var events = [];

    _.forEach(occurrences, function (instance) {
        events.push({
            status: 'open',
            start: moment(instance).toDate(),
            end: moment(instance).add('ms', duration).toDate(),
            activityPlan: plan._id,
            idea: plan.idea,
            owner: ownerId,
            campaign: plan.campaign
        });
    });

    return events;
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

    if (!sentPlan.mainEvent.recurrence.byday) {
        sentPlan.mainEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    // generate all events from the sentPlan to validate -> sentEvents
    var newEvents = _getEvents(sentPlan, req.user.id);

    // load all planned events of this user that:
    //     plannedEvent.start before the end of the last sentEvent.end
    // AND
    //     .plannedEventend after the begin of the first sentEvent.start
    // only these events can have conflicts

    // TODO: improve performance by only loading plans that possibly conflict. This query here uses the status flag which is good enough to filter all old events.
    // var beginOfFirstNewEvent = newEvents[0].start;
    // var endOfLastNewEvent = newEvents[newEvents.length-1].end;


    // if the sentPlan has an id, we want to exclude it from the conflicts-search, because this is an editing of a plan
    // and conflicts with itself should not be returned.
    var q = ActivityEvent
        .find({owner: req.user._id, status: 'open'});

    if (sentPlan.id) {
        q.where({$ne: {activityPlan: mongoose.Types.ObjectId(sentPlan.id)}});
    }
    q.exec(function (err, oldEvents) {
        if (err) {
            return error.handleError(err, next);
        }
        var conflicts = [];

        // put the events of the loaded plans in an ordered list by beginDate
        var plannedEvents = [];

        _.forEach(oldEvents, function (event) {
            // use plain "non-mongoose" object to prevent troubles with serializing the "pseudo attribute" title
            var plainEventObj = event.toObject();
            // plainEventObj.title = plan.title;
            delete plainEventObj._id;
            plannedEvents.push(plainEventObj);
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
                return ((plannedEvent.start < newEvent.end) && (plannedEvent.end > newEvent.start));
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

    if (!sentPlan.idea) {
        return next(new error.MissingParameterError('"idea" is a required attribute', { required: 'idea' }));
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

    // set the byday of the mainEvent to the user's default if the client did not do it, only for daily activities
    if (sentPlan.mainEvent.frequency === 'day' && !sentPlan.mainEvent.recurrence.byday) {
        sentPlan.mainEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    var newActPlan = new ActivityPlan(sentPlan);

    _saveNewActivityPlan(newActPlan, req, function (err, plan) {
        if (err) {
            return error.handleError(err, next);
        }

        var events = _getEvents(plan, req.user.id);

        ActivityEvent.create(events, function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            generic.writeObjCb(req, res, next)(null, plan);
        });
    });
}


/**
 * save new activityPlan with a mongoose obj that already has been validated
 *
 * @param plan - activityPlan obj
 * @param req - the request
 * @param cb - callback(err, savedPlan)
 */
function _saveNewActivityPlan(plan, req, cb) {
    var user = req.user;
    var i18n = req.i18n;

    // add fields of idea to the activityPlan
    Idea.findById(plan.idea).exec(function (err, foundIdea) {
        if (err) {
            return cb(err);
        }

        if (!foundIdea) {
            return cb(new error.InvalidArgumentError('referenced idea not found', { required: 'idea', idea: plan.idea }));
        }

        plan.fields = foundIdea.fields;

        if (!plan.title) {
            plan.title = foundIdea.title;
        }

        plan.save(function (err, savedPlan) {
            if (err) {
                return cb(err);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'idea' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlan.findById(savedPlan._id).populate('idea owner').exec(function (err, reloadedActPlan) {
                if (err) {
                    return cb(err);
                }

                if (user && user.email && user.profile.prefs.email.iCalInvites) {
                    req.log.debug({start: reloadedActPlan.mainEvent.start, end: reloadedActPlan.mainEvent.end}, 'Saved New Plan');
                    var myIcalString = calendar.getIcalObject(reloadedActPlan, user, 'new', i18n).toString();
                    email.sendCalInvite(user, 'new', myIcalString, reloadedActPlan, i18n);
                }

                actMgr.emit('activity:planSaved', reloadedActPlan);

                // remove the populated idea and masterplan because the client is not gonna expect it to be populated.
                reloadedActPlan.idea = reloadedActPlan.idea._id;

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
                return error.handleError(err, next);
            }
            if (req.user && req.user.email && req.user.profile.prefs.email.iCalInvites) {
                var myIcalString = calendar.getIcalObject(masterPlan, req.user, 'new', req.i18n).toString();
                email.sendCalInvite(req.user, 'new', myIcalString, masterPlan, req.i18n);
            }
            masterPlan.save(generic.writeObjCb(req, res, next));
            actMgr.emit('activity:planJoined', masterPlan, req.user);
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
                .populate('idea')
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

            // collect known users for storing invitations
            var recipients = [];

            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUsers) {
                            if (err) {
                                return done(err);
                            }

                            if (invitedUsers && invitedUsers.length === 1) {
                                recipients.push(invitedUsers[0]);
                            } else {
                                recipients.push(emailaddress);
                            }

                            email.sendActivityPlanInvite(emailaddress, req.user, locals.plan, invitedUsers && invitedUsers[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    SocialInteraction.emit('invitation:activityPlan', req.user, recipients, locals.plan);
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


function _sendIcalMessages(activityPlan, joiner, req, reason, type, done) {
    var users;
    if (joiner) {
        users = [joiner];
    } else {
        users = [activityPlan.owner].concat(activityPlan.joiningUsers);
    }

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, populatedUsers) {
        async.forEach(populatedUsers, function (user, next) {
                if (user.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(activityPlan, user, type, req.i18n, reason).toString();
                    email.sendCalInvite(user, type, myIcalString, activityPlan, req.i18n, reason);
                }
                return next();
            },
            done);
    });
}
function _deleteActivityEvents(activityPlan, joiner, fromDate, done) {

    var q = ActivityEvent
        .remove({activityPlan: activityPlan._id});

    if (fromDate) {
        q.where({start: {$gte: fromDate}});
    }

    if (joiner) {
        q.where({owner: joiner._id});
    }

    q.exec(function (err, count) {
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

    ActivityPlan
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, activityPlan) {

            if (err) {
                return error.handleError(err, next);
            }
            if (!activityPlan) {
                return next(new error.ResourceNotFoundError('ActivityPlan not found.', {
                    id: req.params.id
                }));
            }
            var joiner = _.find(activityPlan.joiningUsers, function (user) {
                return user.equals(req.user);
            });

            var sysadmin = auth.checkAccess(req.user, auth.accessLevels.al_systemadmin);

            var owner = activityPlan.owner._id.equals(req.user._id);

            // plan can be deleted if user is systemadmin or if it is his own plan or if the user is a joiner
            if (!(sysadmin || owner || joiner)) {
                return next(new error.NotAuthorizedError());
            }

            if (activityPlan.deleteStatus === ActivityPlan.notDeletableNoFutureEvents && !sysadmin) {
                // if this is not deletable because of no future events we have in fact
                // nothing to do, we just pretend that we deleted all future events, by doing nothing
                // and signalling success
                actMgr.emit('activity:planDeleted', activityPlan);
                res.send(200);
                return next();
            }

            function _deleteEvents(done) {
                if (sysadmin) {
                    _deleteActivityEvents(activityPlan, joiner, null, done);
                } else {
                    _deleteActivityEvents(activityPlan, joiner, new Date(), done);
                }
            }

            function _sendCalendarCancelMessages(done) {
                _sendIcalMessages(activityPlan, joiner, req, reason, 'cancel', done);
            }

            function _deletePlan(done) {

                if (joiner) {
                    activityPlan.joiningUsers.remove(req.user);
                    activityPlan.save(done);
                } else {
                    var deleteStatus = activityPlan.deleteStatus;
                    if (deleteStatus === 'deletable' || sysadmin) {
                        activityPlan.remove(done);
                    } else if (deleteStatus === 'deletableOnlyFutureEvents') {
                        activityPlan.status = 'old';
                        if (activityPlan.mainEvent.frequency !== 'once') {
                            activityPlan.mainEvent.recurrence.on = new Date();
                            activityPlan.mainEvent.recurrence.after = undefined;
                            activityPlan.save(done);
                        } else {
                            throw new Error('should never arrive here, it is not possible to have an "once" plan that has ' +
                                'passed and future events at the same time');
                        }
                    } else {
                        throw new Error('unknown DeleteStatus: ' + activityPlan.deleteStatus);
                    }

                }

            }

            return async.parallel([
                    _sendCalendarCancelMessages,
                    _deleteEvents,
                    _deletePlan
                ],
                function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    actMgr.emit('activity:planDeleted', activityPlan);
                    res.send(200);
                    return next();
                });
        });
}


function putActivityPlan(req, res, next) {
    var sentPlan = req.body;
    var err = handlerUtils.checkWritingPreCond(sentPlan, req.user, ActivityPlan);
    if (err) {
        return error.handleError(err, next);
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


    ActivityPlan
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, loadedActPlan) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!loadedActPlan) {
                return next(new error.ResourceNotFoundError('ActivityPlan not found.', { id: sentPlan.id }));
            }

            // check to see if received plan is editable
            if (loadedActPlan.editStatus !== "editable") {
                return next(new error.ConflictError('Error updating in Idea Plan PutFn: Not allowed to edit this activityPlan.', {
                    activityPlanId: sentPlan.id,
                    editStatus: loadedActPlan.editStatus
                }));
            }

            // we do not allow to update the owner of a plan and the joiningUsers array directly with a put.
            delete sentPlan.owner;
            delete sentPlan.joiningUsers;

            _.extend(loadedActPlan, sentPlan);


            function _savePlan(done) {
                loadedActPlan.save(done);
            }

            function _deleteEventsInFuture(done) {
                if (sentPlan.mainEvent && !_.isEqual(sentPlan.mainEvent, loadedActPlan.mainEvent)) {
                    return _deleteActivityEvents(loadedActPlan, null, new Date(), done);
                } else {
                    return done();
                }
            }

            function _sendCalendarUpdates(done) {
                _sendIcalMessages(loadedActPlan, null, req, null, 'cancel', done);
            }


            function finalCb(err) {
                if (err) {
                    return error.handleError(err, next);
                }

                loadedActPlan.idea = loadedActPlan.idea._id;

                actMgr.emit('activity:planUpdated', loadedActPlan);

                res.send(200, loadedActPlan);
                return next();
            }


            function _updateEventsForAllUsers(done) {
                if (sentPlan.mainEvent && !_.isEqual(sentPlan.mainEvent, loadedActPlan.mainEvent)) {
                    var users = [loadedActPlan.owner].concat(loadedActPlan.joiningUsers);

                    return async.forEach(users, function (user, cb) {
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
                    function (done) {
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
    postJoinActivityPlanFn: postJoinActivityPlanFn,
    postActivityPlanInvite: postActivityPlanInvite,
    deleteActivityPlan: deleteActivityPlan,
    putActivityPlan: putActivityPlan,
    getActivityPlanConflicts: getActivityPlanConflicts
};