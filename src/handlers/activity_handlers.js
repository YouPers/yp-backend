var calendar = require('../util/calendar'),
    mongoose = require('ypbackendlib').mongoose,
    Activity = mongoose.model('Activity'),
    ActivityEvent = mongoose.model('ActivityEvent'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    actMgr = require('../core/ActivityManagement'),
    SocialInteraction = require('../core/SocialInteraction'),
    generic = require('ypbackendlib').handlers,
    error = require('ypbackendlib').error,
    _ = require('lodash'),
    async = require('async'),
    handlerUtils = require('ypbackendlib').handlerUtils;


function _hasValidPathId(req) {
    return req.params && req.params.id && mongoose.Types.ObjectId.isValid(req.params.id);
}

function getInvitationStatus(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found', {id: req.params && req.params.id}));
    }
    SocialInteraction.getInvitationStatus(req.params.id, generic.sendListCb(req, res, next));
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
    if (!sentActivity.start) {
        return next(new error.MissingParameterError({ required: 'start' }));
    }
    if (!sentActivity.end) {
        return next(new error.MissingParameterError({ required: 'end' }));
    }

    if (!sentActivity.idea) {
        return next(new error.MissingParameterError('"idea" is a required attribute', { required: 'idea' }));
    }

    if (sentActivity.joiningUsers && sentActivity.joiningUsers.length > 0) {
        return next(new error.InvalidArgumentError('"joiningUsers" has to be emtpy for new activity, use JOIN Api to join an existing activity'));
    }

    actMgr.saveNewActivity(sentActivity, req.user, req.i18n, generic.writeObjCb(req, res, next));
}


function deleteActivity(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found', {id: req.params && req.params.id}));
    }

    var reason = req.params.reason || 'The organizer Deleted this activity';

    actMgr.deleteActivity(req.params.id, req.user, reason, req.i18n, generic.writeObjCb(req, res, next));
}


function putActivity(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found', {id: req.params && req.params.id}));
    }
    var sentActivity = req.body;
    var err = handlerUtils.checkWritingPreCond(sentActivity, req.user, Activity);
    if (err) {
        return error.handleError(err, next);
    }

    if (req.params.id && sentActivity.id && req.params.id !== sentActivity.id) {
        return error.handleError(new error.InvalidArgumentError('path id: '+ req.id +' does not match body id: ' + sentActivity.id), next);
    }

    actMgr.putChangedActivity(req.params.id, sentActivity, req.user, req.i18n, generic.writeObjCb(req, res, next));
}



function postJoinActivityFn(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found', {id: req.params && req.params.id}));
    }
   actMgr.postJoinActivityFn(req.params.id, req.user, req.i18n,generic.writeObjCb(req, res, next));
}


function postActivityInvite(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found', {id: req.params && req.params.id}));
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

    actMgr.postActivityInvite(req.params.id, req.user, emails, req.i18n, generic.writeObjCb(req, res, next));
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

    dbQuery.where({status: {$ne: 'deleted'}});

    var op = generic.addStandardQueryOptions(req, dbQuery, Activity);
    op.exec(generic.sendListCb(req, res, next));

}

function getIcal(req, res, next) {
    if (!_hasValidPathId(req)) {
        return next(new error.InvalidArgumentError('no valid id found: ' + req.params && req.params.id));
    }

    if (!req.params.user) {
        return next(new error.MissingParameterError({ required: 'user' }));
    }
    if (!req.params.type) {
        return next(new error.MissingParameterError({ required: 'type' }));
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
                return next(new error.ResourceNotFoundError({activity: req.params.id}));
            }
            mongoose.model('User').findById(req.params.user).select('+email +profile').populate('profile').exec(function (err, user) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (!user) {
                    return next(new error.ResourceNotFoundError({user: req.params.user}));
                }
                var ical = calendar.getIcalObject(loadedActivity, user, req.params.type || 'new', req.i18n).toString();
                res.contentType = 'text/calendar';
                res.send(ical);
                return next();

            });
        });
}


function getActivityLookAheadCounters(req, res, next) {


    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
//
//    if(!req.params.since) {
//        return next(new error.MissingParameterError({ required: 'since' }));
//    }

    var lastAccessSince = req.params.since;
    var locals = {};

    function _newCommentsCount(done) {

        var finder = {
            __t: 'Message',
            targetSpaces: {
                $elemMatch: { targetId: req.params.id }
            }
        };

        if(lastAccessSince) {
            finder.created = {
                $gt: lastAccessSince
            };
        }

        SocialInteractionModel.count(finder).exec(function (err, count) {
            if (err) {
                return done(err);
            }
            locals.comments = count;
            done();
        });
    }

    function _newJoiningUsersCount(done) {
        var finder = {
            __t: 'Invitation',
            activity: mongoose.Types.ObjectId(req.params.id)
        };

        // all invitations for this activity
        SocialInteractionModel.find(finder).exec(function (err, invitations) {
            if (err) {
                return done(err);
            }

            var finder = {
                socialInteraction: { $in: _.map(invitations, '_id') },
                reason: 'activityJoined'
            };

            if(lastAccessSince) {
                finder.created = {
                    $gt: lastAccessSince
                };
            }

            // all new activityJoined
            SocialInteractionDismissedModel.count(finder).exec(function (err, count) {
                if (err) {
                    return done(err);
                }
                locals.joiningUsers = count;
                done();
            });

        });
    }

    async.parallel([
            _newCommentsCount,
            _newJoiningUsersCount
        ],
        function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            res.send(locals);
            return next();
        });

}




function validateActivity(req, res, next) {
    var sentActivity = req.body;

    // check required Attributes
    if (!sentActivity.start) {
        return next(new error.MissingParameterError({ required: 'start' }));
    }
    if (!sentActivity.end) {
        return next(new error.MissingParameterError({ required: 'end' }));
    }

    if (!sentActivity.recurrence.byday) {
        sentActivity.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    // generate all events from the sentActivity to validate -> sentEvents
    var newEvents = actMgr.getEvents(sentActivity, req.user.id);

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
        q.where({activity: {$ne: mongoose.Types.ObjectId(sentActivity.id)}});
    }
    q.exec(function (err, oldEvents) {
        if (err) {
            return error.handleError(err, next);
        }
        var validationResult = [];

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

            validationResult.push({event: newEvent, conflictingEvent: conflictingEvent});
        });


        // load all activities for the conflicting events to populate them
        var conflictingEvents = _.compact(_.map(validationResult, 'conflictingEvent'));
        var conflictingEventActivities = _.map(conflictingEvents, 'activity');
        Activity.find({ _id: { $in: conflictingEventActivities }}, function (err, activities) {
            if(err) {
                return error.handleError(err, next);
            }
            var activitiesById = _.indexBy(activities, function(activity) {
                return activity._id.toString();
            });

            _.each(validationResult, function(result) {
                if(result.conflictingEvent) {
                    var conflictingActivityResult = activitiesById[result.conflictingEvent.activity.toString()];
                    result.conflictingEvent.activity = conflictingActivityResult;
                }
            });

            res.send(validationResult);
            return next();

        });

    });
}



module.exports = {
    postNewActivity: postNewActivity,
    postJoinActivityFn: postJoinActivityFn,
    postActivityInvite: postActivityInvite,
    deleteActivity: deleteActivity,
    putActivity: putActivity,
    getInvitationStatus: getInvitationStatus,
    getActivityLookAheadCounters: getActivityLookAheadCounters,
    validateActivity: validateActivity,
    getIcal: getIcal,
    getAll: getAll
};