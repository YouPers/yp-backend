var calendar = require('../util/calendar'),
    mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
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

function _getEvents(activity, ownerId, fromDate) {

    var duration = moment(activity.mainEvent.end).diff(activity.mainEvent.start);

    var occurrences = calendar.getOccurrences(activity, fromDate);

    var events = [];

    _.forEach(occurrences, function (instance) {
        events.push({
            status: 'open',
            start: moment(instance).toDate(),
            end: moment(instance).add('ms', duration).toDate(),
            activity: activity._id,
            idea: activity.idea,
            owner: ownerId,
            campaign: activity.campaign
        });
    });

    return events;
}

function getActivityConflicts(req, res, next) {
    var sentActivity = req.body;

    // check required Attributes
    if (!sentActivity.mainEvent) {
        return next(new error.MissingParameterError({ required: 'mainEvent' }));
    }

    if (!sentActivity.mainEvent.start) {
        return next(new error.MissingParameterError({ required: 'mainEvent.start' }));
    }
    if (!sentActivity.mainEvent.end) {
        return next(new error.MissingParameterError({ required: 'mainEvent.end' }));
    }

    if (!sentActivity.mainEvent.recurrence.byday) {
        sentActivity.mainEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    // generate all events from the sentActivity to validate -> sentEvents
    var newEvents = _getEvents(sentActivity, req.user.id);

    // load all planned events of this user that:
    //     plannedEvent.start before the end of the last sentEvent.end
    // AND
    //     .plannedEventend after the begin of the first sentEvent.start
    // only these events can have conflicts

    // TODO: improve performance by only loading plans that possibly conflict. This query here uses the status flag which is good enough to filter all old events.
    // var beginOfFirstNewEvent = newEvents[0].start;
    // var endOfLastNewEvent = newEvents[newEvents.length-1].end;


    // if the sentActivity has an id, we want to exclude it from the conflicts-search, because this is an editing of a activity
    // and conflicts with itself should not be returned.
    var q = ActivityEvent
        .find({owner: req.user._id, status: 'open'});

    if (sentActivity.id) {
        q.where({$ne: {activity: mongoose.Types.ObjectId(sentActivity.id)}});
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
            // plainEventObj.title = activity.title;
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
 * handles a POST request to /Activity
 * generates all the ActivityEvents according to the planning options in the activity.
 *
 * @param req
 * @param res
 * @param next
 */
function postNewActivity(req, res, next) {
    var sentActivity = req.body;

    var err = handlerUtils.checkWritingPreCond(sentActivity, req.user, Activity);
    if (err) {
        return error.handleError(err, next);
    }

    // check required Attributes
    if (!sentActivity.mainEvent) {
        return next(new error.MissingParameterError({ required: 'mainEvent' }));
    }

    if (!sentActivity.mainEvent.start) {
        return next(new error.MissingParameterError({ required: 'mainEvent.start' }));
    }
    if (!sentActivity.mainEvent.end) {
        return next(new error.MissingParameterError({ required: 'mainEvent.end' }));
    }

    if (!sentActivity.idea) {
        return next(new error.MissingParameterError('"idea" is a required attribute', { required: 'idea' }));
    }

    if (sentActivity.joiningUsers && sentActivity.joiningUsers.length > 0) {
        return next(new error.InvalidArgumentError('"joiningUsers" has to be emtpy for new activity, use JOIN Api to join an existing activity'));
    }

    // check whether delivered owner is the authenticated user
    if (sentActivity.owner && (req.user.id !== sentActivity.owner)) {
        return next(new error.NotAuthorizedError({
            userId: req.user.id,
            owner: sentActivity.owner
        }));
    }

    // if no owner delivered set to authenticated user
    if (!sentActivity.owner) {
        sentActivity.owner = req.user.id;
    }

    // set the campaign that this activity is part of if it has not been set by the client
    if (!sentActivity.campaign && req.user.campaign) {
        sentActivity.campaign = req.user.campaign.id || req.user.campaign; // allow populated and unpopulated campaign
    }

    // set the byday of the mainEvent to the user's default if the client did not do it, only for daily activities
    if (sentActivity.mainEvent.frequency === 'day' && !sentActivity.mainEvent.recurrence.byday) {
        sentActivity.mainEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    var newActivity = new Activity(sentActivity);

    _saveNewActivity(newActivity, req, function (err, savedActivity) {
        if (err) {
            return error.handleError(err, next);
        }

        var events = _getEvents(savedActivity, req.user.id);

        ActivityEvent.create(events, function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            generic.writeObjCb(req, res, next)(null, savedActivity);
        });
    });
}


/**
 * save new activity with a mongoose obj that already has been validated
 *
 * @param plan - activity obj
 * @param req - the request
 * @param cb - callback(err, savedPlan)
 */
function _saveNewActivity(activity, req, cb) {
    var user = req.user;
    var i18n = req.i18n;

    // add fields of idea to the activity
    Idea.findById(activity.idea).exec(function (err, foundIdea) {
        if (err) {
            return cb(err);
        }

        if (!foundIdea) {
            return cb(new error.InvalidArgumentError('referenced idea not found', { required: 'idea', idea: activity.idea }));
        }

        if (!activity.title) {
            activity.title = foundIdea.title;
        }

        activity.save(function (err, savedActivity) {
            if (err) {
                return cb(err);
            }

            // we reload Activity for two reasons:
            // - populate 'idea' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            Activity.findById(savedActivity._id).populate('idea owner').exec(function (err, reloadedActivity) {
                if (err) {
                    return cb(err);
                }

                if (user && user.email && user.profile.prefs.email.iCalInvites) {
                    req.log.debug({start: reloadedActivity.mainEvent.start, end: reloadedActivity.mainEvent.end}, 'Saved New activity');
                    var myIcalString = calendar.getIcalObject(reloadedActivity, user, 'new', i18n).toString();
                    email.sendCalInvite(user, 'new', myIcalString, reloadedActivity, i18n);
                }

                actMgr.emit('activity:activitySaved', reloadedActivity);

                // remove the populated idea because the client is not gonna expect it to be populated.
                reloadedActivity.idea = reloadedActivity.idea._id;

                return cb(null, reloadedActivity);

            });

        });
    });
}


function postJoinActivityFn(req, res, next) {

    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }

    Activity.findById(req.params.id).exec(function (err, masterActivity) {

        if (err) {
            return error.handleError(err, next);
        }

        if (_.any(masterActivity.joiningUsers, function(joinerObjId) {
            return joinerObjId.equals(req.user._id);
        })) {
            return next(new error.InvalidArgumentError('this user has already joined this activity', {user: req.user, activity: masterActivity}));
        }

        masterActivity.joiningUsers.push(req.user.id);
        var events = _getEvents(masterActivity, req.user.id);

        ActivityEvent.create(events, function (err, events) {
            if (err) {
                return error.handleError(err, next);
            }
            if (req.user && req.user.email && req.user.profile.prefs.email.iCalInvites) {
                var myIcalString = calendar.getIcalObject(masterActivity, req.user, 'new', req.i18n).toString();
                email.sendCalInvite(req.user, 'new', myIcalString, masterActivity, req.i18n);
            }
            masterActivity.save(generic.writeObjCb(req, res, next));
            actMgr.emit('activity:activityJoined', masterActivity, req.user);
        });
    });

}


function postActivityInvite(req, res, next) {
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
        // first load Activity
        function (done) {
            Activity.findById(req.params.id)
                .populate('idea')
                .populate('owner')
                .exec(function (err, activity) {
                    if (err) {
                        return done(err);
                    }
                    if (!activity) {
                        return done(new error.ResourceNotFoundError('Activity not found.', {
                            id: req.params.id
                        }));
                    }
                    locals.activity = activity;
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

                            email.sendActivityInvite(emailaddress, req.user, locals.activity, invitedUsers && invitedUsers[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    SocialInteraction.emit('invitation:activity', req.user, recipients, locals.activity);
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


function _sendIcalMessages(activity, joiner, req, reason, type, done) {
    var users;
    if (joiner) {
        users = [joiner];
    } else {
        users = [activity.owner].concat(activity.joiningUsers);
    }

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, populatedUsers) {
        async.forEach(populatedUsers, function (user, next) {
                if (user.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(activity, user, type, req.i18n, reason).toString();
                    email.sendCalInvite(user, type, myIcalString, activity, req.i18n, reason);
                }
                return next();
            },
            done);
    });
}
function _deleteActivityEvents(activity, joiner, fromDate, done) {

    var q = ActivityEvent
        .remove({activity: activity._id});

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

function deleteActivity(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    var reason = req.params.reason || 'The organizer Deleted this activity';

    Activity
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, activity) {

            if (err) {
                return error.handleError(err, next);
            }
            if (!activity) {
                return next(new error.ResourceNotFoundError('Activity not found.', {
                    id: req.params.id
                }));
            }
            var joiner = _.find(activity.joiningUsers, function (user) {
                return user.equals(req.user);
            });

            var sysadmin = auth.checkAccess(req.user, auth.accessLevels.al_systemadmin);

            var owner = activity.owner._id.equals(req.user._id);

            // activity can be deleted if user is systemadmin or if it is his own activity or if the user is a joiner
            if (!(sysadmin || owner || joiner)) {
                return next(new error.NotAuthorizedError());
            }

            if (activity.deleteStatus === Activity.notDeletableNoFutureEvents && !sysadmin) {
                // if this is not deletable because of no future events we have in fact
                // nothing to do, we just pretend that we deleted all future events, by doing nothing
                // and signalling success
                actMgr.emit('activity:activityDeleted', activity);
                res.send(200);
                return next();
            }

            function _deleteEvents(done) {
                if (sysadmin) {
                    _deleteActivityEvents(activity, joiner, null, done);
                } else {
                    _deleteActivityEvents(activity, joiner, new Date(), done);
                }
            }

            function _sendCalendarCancelMessages(done) {
                _sendIcalMessages(activity, joiner, req, reason, 'cancel', done);
            }

            function _deleteActivity(done) {

                if (joiner) {
                    activity.joiningUsers.remove(req.user);
                    activity.save(done);
                } else {
                    var deleteStatus = activity.deleteStatus;
                    if (deleteStatus === 'deletable' || sysadmin) {
                        activity.remove(done);
                    } else if (deleteStatus === 'deletableOnlyFutureEvents') {
                        activity.status = 'old';
                        if (activity.mainEvent.frequency !== 'once') {
                            activity.mainEvent.recurrence.on = new Date();
                            activity.mainEvent.recurrence.after = undefined;
                            activity.save(done);
                        } else {
                            throw new Error('should never arrive here, it is not possible to have an "once" activity that has ' +
                                'passed and future events at the same time');
                        }
                    } else {
                        throw new Error('unknown DeleteStatus: ' + activity.deleteStatus);
                    }

                }

            }

            return async.parallel([
                    _sendCalendarCancelMessages,
                    _deleteEvents,
                    _deleteActivity
                ],
                function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    actMgr.emit('activity:activityDeleted', activity);
                    res.send(200);
                    return next();
                });
        });
}


function putActivity(req, res, next) {
    var sentActivity = req.body;
    var err = handlerUtils.checkWritingPreCond(sentActivity, req.user, Activity);
    if (err) {
        return error.handleError(err, next);
    }

    // check required Attributes, if we get a main event, at least from and to must be set
    if (sentActivity.mainEvent) {
        if (!sentActivity.mainEvent.start) {
            return next(new error.MissingParameterError({ required: 'mainEvent.start' }));
        }
        if (!sentActivity.mainEvent.end) {
            return next(new error.MissingParameterError({ required: 'mainEvent.end' }));
        }
    }


    Activity
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, loadedActivity) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!loadedActivity) {
                return next(new error.ResourceNotFoundError('Activity not found.', { id: sentActivity.id }));
            }

            // check to see if received activity is editable
            if (loadedActivity.editStatus !== "editable") {
                return next(new error.ConflictError('Error updating in activityPutFn: Not allowed to edit this activity.', {
                    activityId: sentActivity.id,
                    editStatus: loadedActivity.editStatus
                }));
            }

            // we do not allow to update the owner of and the joiningUsers array directly with a put.
            delete sentActivity.owner;
            delete sentActivity.joiningUsers;

            _.extend(loadedActivity, sentActivity);


            function _saveActivity(done) {
                loadedActivity.save(done);
            }

            function _deleteEventsInFuture(done) {
                if (sentActivity.mainEvent && !_.isEqual(sentActivity.mainEvent, loadedActivity.mainEvent)) {
                    return _deleteActivityEvents(loadedActivity, null, new Date(), done);
                } else {
                    return done();
                }
            }

            function _sendCalendarUpdates(done) {
                _sendIcalMessages(loadedActivity, null, req, null, 'cancel', done);
            }


            function finalCb(err) {
                if (err) {
                    return error.handleError(err, next);
                }

                loadedActivity.idea = loadedActivity.idea._id;

                actMgr.emit('activity:activityUpdated', loadedActivity);

                res.send(200, loadedActivity);
                return next();
            }


            function _updateEventsForAllUsers(done) {
                if (sentActivity.mainEvent && !_.isEqual(sentActivity.mainEvent, loadedActivity.mainEvent)) {
                    var users = [loadedActivity.owner].concat(loadedActivity.joiningUsers);

                    return async.forEach(users, function (user, cb) {
                        var events = _getEvents(loadedActivity, user._id, new Date());
                        ActivityEvent.create(events, cb);
                    }, done);
                } else {
                    return done();
                }

            }

            return async.parallel([
                    _saveActivity,
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

function getAll(req, res, next) {

    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    }
    var finder = { $or: [
        { owner: req.user.id },
        { joiningUsers: req.user.id }
    ]};

    var dbQuery = Activity.find(finder);

    generic.addStandardQueryOptions(req, dbQuery, Activity)
        .exec(generic.sendListCb(req, res, next));

}

module.exports = {
    postNewActivity: postNewActivity,
    postJoinActivityFn: postJoinActivityFn,
    postActivityInvite: postActivityInvite,
    deleteActivity: deleteActivity,
    putActivity: putActivity,
    getActivityConflicts: getActivityConflicts,
    getAll: getAll
};