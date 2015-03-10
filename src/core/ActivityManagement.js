var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('ypbackendlib').mongoose;
var _ = require('lodash');
_.mixin(require("lodash-deep"));
var moment = require('moment-timezone');
var calendar = require('../util/calendar');
var User = mongoose.model('User');
var Invitation = mongoose.model('Invitation');
var Idea = mongoose.model('Idea');
var Campaign = mongoose.model('Campaign');
var Assessment = mongoose.model('Assessment');
var Activity = mongoose.model('Activity');
var ActivityEvent = mongoose.model('ActivityEvent');
var SocialInteraction = require('../core/SocialInteraction');
var config = require('../config/config');
var log = require('ypbackendlib').log(config);
var async = require('async');
var error = require('ypbackendlib').error;
var email = require('../util/email');
var auth = require('ypbackendlib').auth;


var DEFAULT_WORK_WEEK = ['MO', 'TU', 'WE', 'TH', 'FR'];

function ActivityManagement() {
    EventEmitter.call(this);
}

util.inherits(ActivityManagement, EventEmitter);
var actMgr = new ActivityManagement();


//////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////


/**
 * on change of a user's campaign
 *
 *  - schedule assessment activity
 *
 */

User.on('change:campaign', function (user) {

    Campaign.findById(user.campaign).exec(function (err, campaign) {
        if (err) {
            return _handleError(err);
        }

        Assessment.find({topic: campaign.topic}).exec(function (err, assessments) {
            if (err) {
                return _handleError(err);
            }

            if (assessments.length !== 1) {
                return actMgr.emit('error', 'assessment for topic not found or not unique');
            }
            var assessment = assessments[0];
            if (assessment.idea) {

                Activity.find({
                    owner: user._id,
                    idea: assessment.idea,
                    status: 'active'
                }).exec(function (err, activities) {
                    if (err) {
                        return _handleError(err);
                    }

                    // only plan assessment idea if there is no active activity yet
                    if (activities.length === 0) {

                        mongoose.model('Profile').findById(user.profile).exec(function (err, profile) {
                            if (err) {
                                return _handleError(err);
                            }

                            Idea.findById(assessment.idea).select(Idea.getI18nPropertySelector(profile.language)).exec(function (err, idea) {
                                if (err) {
                                    return _handleError(err);
                                }
                                var assessmentActivity = actMgr.defaultActivity(idea, user);
                                assessmentActivity.start = new Date();
                                assessmentActivity.end = moment(assessmentActivity.start).add(15, 'm').toDate();
                                assessmentActivity.save(function (err, savedActivity) {
                                    if (err) {
                                        return _handleError(err);
                                    }
                                    var events = actMgr.getEvents(savedActivity, user.id);
                                    ActivityEvent.create(events, function (err) {
                                        if (err) {
                                            return _handleError(err);
                                        }
                                        actMgr.emit('activity:activityCreated', savedActivity, user);
                                    });
                                });

                            });


                        });
                    }
                });

            }
        });

    });
});

/**
 * on Change of an ActivityEvent Status, check whether this was the last open ActivityEvent
 * for this activity. If there are no more open Events change the status of the activity to 'old'
 */
ActivityEvent.on("change:status", function (event) {
    // we can stop looking, if the event that was changed is still open, e.g. when it is new.
    if (event.status === 'open') {
        return;
    }

    log.debug("checking whether Activity needs to be put to status 'old'");
    ActivityEvent.count({_id: {$ne: event._id}, status: 'open', activity: event.activity}).exec(function (err, count) {
        if (err) {
            log(err);
            throw err;
        }
        log.debug("found " + count + " events that are still active");
        if (count === 0) {
            Activity.update({_id: event.activity}, {status: 'old'}, function (err, numAffected) {
                if (err || numAffected > 1) {
                    log.err(err || "more than one activity changed, should never happen");
                }

            });
        }
    });
});

/**
 * On Campaign delete, check whether there are activities and activityEvents in this campaign, and remove them too.
 */
Campaign.on('remove', function (campaign) {

    function _removeAll(err, objs) {
        async.forEach(objs, function (obj, cb) {
            obj.remove(cb);
        }, function (err) {
            if (err) {
                log.error(err);
                throw err;
            }
        });
    }

    Activity.find({campaign: campaign._id}).exec(_removeAll);
    ActivityEvent.find({campaign: campaign._id}).exec(_removeAll);
});


actMgr.on('activity:activityCreated', function (activity, user) {

    // find and dismiss all recommendations for this idea
    SocialInteraction.dismissRecommendations(activity.idea, user, {reason: 'activityScheduled'});
});

actMgr.on('activity:activityJoined', function (activity, joinedUser) {

    SocialInteraction.dismissRecommendations(activity.idea, joinedUser, {reason: 'activityJoined'}, _handleError);
    SocialInteraction.dismissInvitations(activity, joinedUser, {reason: 'activityJoined'}, _handleError);

});


actMgr.on('activity:activityDeleted', function (activity) {
    SocialInteraction.deleteSocialInteractions(activity, _handleError);
});

actMgr.on('activity:participationCancelled', function (activity, user) {
    SocialInteraction.removeDismissals(activity, user, _handleError);
});

actMgr.on('activity:activityUpdated', function (updatedActivity) {
    Invitation.find({
            activity: updatedActivity._id
        }
    ).exec(function (err, invitations) {
            _.forEach(invitations, function (invitation) {
                // The publishTo of the invitation has to be equal or earlier than the last event,
                // it does not make sense to invite something that has already happened.
                if (invitation.publishTo > updatedActivity.lastEventEnd) {
                    invitation.publishTo = updatedActivity.lastEventEnd;
                    invitation.save(function (err, saved) {
                        if (err) {
                            return actMgr.emit('error', err);
                        }
                    });
                }
            });
        });

});


/////////////////////////////////////////
// internal methods
/////////////////////////////////////////

function _handleError(err) {
    if (err) {
        return actMgr.emit('error', err);
    }
}

actMgr.on('error', function (err) {
    log.error(err);
    throw new Error(err);
});


/**
 * save new activity with a mongoose obj that already has been validated
 *
 * @param req - the request
 * @param cb - callback(err, savedPlan)
 * @param activity
 */
function _saveNewActivity(activity, user, i18n, cb) {

    // add fields of idea to the activity
    Idea.findById(activity.idea, mongoose.model('Idea').getI18nPropertySelector(i18n.locale())).exec(function (err, foundIdea) {
        if (err) {
            return cb(err);
        }

        if (!foundIdea) {
            return cb(new error.InvalidArgumentError('referenced idea not found', {
                required: 'idea',
                idea: activity.idea
            }));
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
            Activity.findById(savedActivity._id)
                .populate({path: 'owner', select: '+email'})
                .populate('idea', mongoose.model('Idea').getI18nPropertySelector(i18n.locale()))
                .exec(function (err, reloadedActivity) {
                    if (err) {
                        return cb(err);
                    }

                    if (user && user.email && user.profile.prefs.email.iCalInvites) {
                        log.debug({start: reloadedActivity.start, end: reloadedActivity.end}, 'Saved New activity');
                        var myIcalString = calendar.getIcalObject(reloadedActivity, user, 'new', i18n).toString();
                        email.sendCalInvite(user, 'new', myIcalString, reloadedActivity, i18n);
                    }

                    // remove the populated idea because the client is not gonna expect it to be populated.
                    reloadedActivity.idea = reloadedActivity.idea._id;

                    return cb(null, reloadedActivity);

                });

        });
    });
}


function _sendIcalMessages(activity, recepient, reason, type, i18n, done) {
    var users;
    if (recepient) {
        users = [recepient];
    } else {
        users = [activity.owner].concat(activity.joiningUsers);
    }

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, populatedUsers) {
        async.forEach(populatedUsers, function (user, next) {
                if (user.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(activity, user, type, i18n, reason).toString();
                    email.sendCalInvite(user, type, myIcalString, activity, i18n, reason);
                }
                return next();
            },
            done);
    });
}

function _deleteActivityEvents(activity, ofUser, fromDate, done) {

    var q = ActivityEvent
        .remove({activity: activity._id});

    if (fromDate) {
        q.where({end: {$gte: fromDate}});
    }

    if (ofUser) {
        q.where({owner: ofUser._id});
    }

    q.exec(function (err, count) {
        if (err) {
            return done(err);
        }
        return done(null, count);
    });
}


///////////////////////////////////////////////////////////////////
// public methods
///////////////////////////////////////////////////////////////////

actMgr.getEvents = function getEvents(activity, ownerId, fromDate) {

    var duration = moment(activity.end).diff(activity.start);

    var occurrences = calendar.getOccurrences(activity, fromDate);

    var events = [];

    _.forEach(occurrences, function (instance) {
        events.push({
            status: 'open',
            start: moment(instance).toDate(),
            end: moment(instance).add(duration, 'ms').toDate(),
            activity: activity._id,
            idea: activity.idea,
            owner: ownerId,
            campaign: activity.campaign
        });
    });

    return events;
};


actMgr.defaultActivity = function (idea, user, campaignId, startDateParam) {

    var duration = idea.defaultduration ? idea.defaultduration : 60;


    if (!campaignId && user.campaign) {
        campaignId = user.campaign._id || user.campaign;
    }

    var start = startDateParam ? moment(startDateParam).tz('Europe/Zurich') : moment().add(1, 'd').tz('Europe/Zurich');

    // check if the organizer is working on this day by checking the default work days in his calendar, if not push
    // back by one day and repeat

    function _isWorkingOn(user, date) {
        var workWeek = user.profile.prefs ? user.profile.prefs.defaultWorkWeek : DEFAULT_WORK_WEEK;
        var dayStringOfThisDate = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.day()];

        return _.contains(workWeek, dayStringOfThisDate);
    }

    while (!_isWorkingOn(user, start)) {
        start = start.add(1, 'day');
    }

    // time of the event is either defined on the idea, or we take the begin of the current hour
    var startTime = idea.defaultStartTime ? moment(idea.defaultStartTime) : moment().startOf('hour');

    start.hours(startTime.tz('Europe/Zurich').hours());
    start.minutes(startTime.minutes());
    start = start.startOf('minute').toDate();

    var activity = {
        owner: user._id || user,
        idea: idea,
        status: 'active',
        executionType: idea.defaultexecutiontype,
        fields: idea.fields,
        topics: idea.topics,
        title: idea.title,
        number: idea.number,
        start: start,
        end: moment(start).add(duration, 'm').toDate(),
        allDay: false,
        frequency: idea.defaultfrequency,
        recurrence: {
            "endby": {
                "type": "after",
                "after": 3
            },
            byday: user.profile.prefs && user.profile.prefs.defaultWorkWeek || undefined,
            every: 1
        }
    };


    if (campaignId) {
        activity.campaign = campaignId;
    }
    var activityDoc = new Activity(activity);

    // repopulate idea
    activityDoc.idea = idea;

    return activityDoc;
};


actMgr.saveNewActivity = function postNewActivity(sentActivity, user, i18n, cb) {

    if (!sentActivity.recurrence) {
        sentActivity.recurrence = {};
    }

    // set the campaign that this activity is part of if it has not been set by the client
    if (!sentActivity.campaign && user.campaign) {
        sentActivity.campaign = user.campaign.id || user.campaign; // allow populated and unpopulated campaign
    }

    // set the byday to the user's default if the client did not do it, only for daily activities
    if (sentActivity.frequency === 'day' && !sentActivity.recurrence.byday) {
        sentActivity.recurrence.byday = _.deepGet(user, 'profile.prefs.defaultWorkWeek') || DEFAULT_WORK_WEEK;
    }

    var newActivity = new Activity(sentActivity);

    _saveNewActivity(newActivity, user, i18n, function (err, savedActivity) {
        if (err) {
            return error.handleError(err, cb);
        }

        var events = actMgr.getEvents(savedActivity, user.id);

        ActivityEvent.create(events, function (err) {
            if (err) {
                return error.handleError(err, cb);
            }

            actMgr.emit('activity:activityCreated', savedActivity, user);

            return cb(null, savedActivity);
        });
    });
};


actMgr.putChangedActivity = function putActivity(idToUpdate, sentActivity, user, i18n, cb) {

    Activity
        .findById(idToUpdate)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, loadedActivity) {
            if (err) {
                return error.handleError(err, cb);
            }
            if (!loadedActivity) {
                return cb(new error.ResourceNotFoundError('Activity not found.', {id: idToUpdate}));
            }

            // check to see if received activity is editable
            if (loadedActivity.editStatus !== "editable") {
                return cb(new error.ConflictError('Error updating in activityPutFn: Not allowed to edit this activity.', {
                    activityId: idToUpdate.id,
                    editStatus: loadedActivity.editStatus
                }));
            }

            // we do not allow to update the owner of and the joiningUsers array directly with a put.
            delete sentActivity.owner;
            delete sentActivity.joiningUsers;

            loadedActivity.set(sentActivity);

            function _saveActivity(done) {
                loadedActivity.save(done);
            }

            function _timeOrFrequencyChanged(loadedAct, sentAct) {
                if (!sentAct.start && !sentAct.end && !sentAct.frequency && !sentAct.recurrence) {
                    // nothing relevant for the events sent, so return false;
                    return false;
                }
                // otherwise compare the relevant fields
                return ((sentAct.start !== loadedAct.start) ||
                (sentAct.end !== loadedAct.end) ||
                (sentAct.frequency !== loadedAct.frequency) || !_.isEqual(sentAct.recurrence, loadedAct.recurrence));
            }


            function _sendCalendarUpdates(done) {
                var reason = '';
                _sendIcalMessages(loadedActivity, null, reason, 'update', i18n, done);
            }

            function _deleteFutureEventsForAllUsers(done) {
                return _deleteActivityEvents(loadedActivity, null, new Date(), done);
            }

            function _createFutureEventsForAllUsers(done) {
                var users = [loadedActivity.owner].concat(loadedActivity.joiningUsers);

                return async.forEach(users, function (user, asyncCb) {
                    var events = actMgr.getEvents(loadedActivity, user._id, new Date());
                    ActivityEvent.create(events, asyncCb);
                }, done);
            }

            var parallelTasks = [_saveActivity, _sendCalendarUpdates];

            if (_timeOrFrequencyChanged(loadedActivity, sentActivity)) {
                parallelTasks.push(
                    function (done) {
                        async.series([
                            _deleteFutureEventsForAllUsers,
                            _createFutureEventsForAllUsers
                        ], done);
                    });
            }

            function finalCb(err) {
                if (err) {
                    return error.handleError(err, cb);
                }

                loadedActivity.idea = loadedActivity.idea._id;

                actMgr.emit('activity:activityUpdated', loadedActivity);
                return cb(null, loadedActivity);
            }

            return async.parallel(parallelTasks, finalCb);
        });
};

actMgr.deleteActivity = function deleteActivity(idToDelete, requestingUser, reason, i18n, cb) {

    Activity
        .findById(idToDelete)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, activity) {

            if (err) {
                return error.handleError(err, cb);
            }
            if (!activity) {
                return cb(new error.ResourceNotFoundError('Activity not found.', {
                    id: idToDelete
                }));
            }
            var joiner = _.find(activity.joiningUsers, function (user) {
                return user.equals(requestingUser);
            });

            var sysadmin = auth.checkAccess(requestingUser, auth.accessLevels.al_systemadmin);

            var owner = activity.owner._id.equals(requestingUser._id);

            // activity can be deleted if user is systemadmin or if it is his own activity or if the user is a joiner
            if (!(sysadmin || owner || joiner)) {
                return cb(new error.NotAuthorizedError());
            }

            if (activity.deleteStatus === Activity.notDeletableNoFutureEvents && !sysadmin) {
                // if this is not deletable because of no future events we have in fact
                // nothing to do, we just pretend that we deleted all future events, by doing nothing
                // and signalling success
                actMgr.emit('activity:activityDeleted', activity);
                return cb();
            }

            function _deleteEvents(done) {
                if (owner) {
                    // the event is cancelled, delete events of everybody that are not passed already
                    _deleteActivityEvents(activity, null, new Date(), done);
                } else if (sysadmin) {
                    // the event is deleted by a sysadmin, delete all related events
                    _deleteActivityEvents(activity, null, null, done);
                } else if (joiner) {
                    // joiner, delete this users future events.
                    _deleteActivityEvents(activity, joiner, new Date(), done);
                } else {
                    throw new Error('this should not be possible');
                }

            }

            function _sendCalendarCancelMessages(done) {
                _sendIcalMessages(activity, joiner, reason, 'cancel', i18n, done);
            }

            function _deleteActivity(done) {

                if (joiner) {
                    activity.joiningUsers.remove(requestingUser);
                    activity.save(done);
                } else {
                    var deleteStatus = activity.deleteStatus;
                    if (deleteStatus === 'deletable' || sysadmin) {
                        activity.status = 'deleted';
                        return activity.save(done);
                    } else if (deleteStatus === 'deletableOnlyFutureEvents') {
                        activity.status = 'old';
                        if (activity.frequency !== 'once') {
                            activity.recurrence.on = new Date();
                            activity.recurrence.after = undefined;
                            return activity.save(done);
                        } else {
                            return done(new Error('should never arrive here, it is not possible to have an "once" activity that has ' +
                            'passed and future events at the same time'));
                        }
                    } else {
                        return done(new Error('unknown DeleteStatus: ' + activity.deleteStatus));
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
                        return error.handleError(err, cb);
                    }
                    if (joiner) {
                        actMgr.emit('activity:participationCancelled', activity, requestingUser);
                    } else {
                        actMgr.emit('activity:activityDeleted', activity);
                    }
                    return cb(null);
                });
        });
};

actMgr.postJoinActivityFn = function (actIdToJoin, joiningUser, i18n, cb) {
    Activity.findById(actIdToJoin).populate({path: 'owner', select: '+email'}).exec(function (err, masterActivity) {

        if (err) {
            return error.handleError(err, cb);
        }

        if (_.any(masterActivity.joiningUsers, function(joinerObjId) {
                return joinerObjId.equals(joiningUser._id);
            })) {
            return cb(new error.InvalidArgumentError('this user has already joined this activity', {user: joiningUser, activity: masterActivity}));
        }

        Activity.findByIdAndUpdate(actIdToJoin, { $push: { joiningUsers: joiningUser._id } }, function (err, updated) {
            if (err) {
                return error.handleError(err, cb);
            }

            var events = actMgr.getEvents(masterActivity, joiningUser.id);

            ActivityEvent.create(events, function (err, events) {
                if (err) {
                    return error.handleError(err, cb);
                }
                if (joiningUser && joiningUser.email && joiningUser.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(masterActivity, joiningUser, 'new', i18n).toString();
                    email.sendCalInvite(joiningUser, 'new', myIcalString, masterActivity, i18n);
                }
                actMgr.emit('activity:activityJoined', masterActivity, joiningUser);
                return cb(null, updated);
            });
        });

    });
};


module.exports = actMgr;
