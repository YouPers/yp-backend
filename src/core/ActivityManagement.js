var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('ypbackendlib').mongoose;
var _ = require('lodash');
var moment = require('moment');
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

function ActivityManagement() {
    EventEmitter.call(this);
}

util.inherits(ActivityManagement, EventEmitter);
var actMgr = new ActivityManagement();

/**
 * on change of a user's campaign
 *
 *  - schedule assessment activity
 *
 */

User.on('change:campaign', function (user) {

    Campaign.findById(user.campaign).exec(function (err, campaign) {
        if (err) {
            handleError(err);
        }

        Assessment.find({ topic: campaign.topic }).exec(function (err, assessments) {
            if (err) {
                handleError(err);
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
                        handleError(err);
                    }

                    // only plan assessment idea if there is no active activity yet
                    if (activities.length === 0) {

                        mongoose.model('Profile').findById(user.profile).exec(function (err, profile) {
                            if (err) {
                                handleError(err);
                            }

                            Idea.findById(assessment.idea).select(Idea.getI18nPropertySelector(profile.language)).exec(function (err, idea) {
                                if (err) {
                                    return handleError(err);
                                }
                                var assessmentActivity = actMgr.defaultActivity(idea, user);
                                assessmentActivity.start = new Date();
                                assessmentActivity.end = moment(assessmentActivity.start).add(15, 'm').toDate();
                                assessmentActivity.save(function (err, savedActivity) {
                                    if (err) {
                                        return handleError(err);
                                    }
                                    var events = actMgr.getEvents(savedActivity, user.id);
                                    ActivityEvent.create(events, function (err) {
                                        if (err) {
                                            return handleError(err);
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

actMgr.defaultActivity = function (idea, user, campaignId) {
    var now = moment();
    var duration = idea.defaultduration ? idea.defaultduration : 60;


    if (!campaignId && user.campaign) {
        campaignId = user.campaign._id || user.campaign;
    }

    var start =  moment(now).add(1, 'd').startOf('hour').toDate();

    var activity = {
        owner: user
            .
            _id || user,
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


actMgr.on('activity:activityCreated', function (activity, user) {

    // find and dismiss all recommendations for this idea
    SocialInteraction.dismissRecommendations(activity.idea, user, { reason: 'activityScheduled'});
});

actMgr.on('activity:activitySaved', function (activity) {


});

actMgr.on('activity:activityJoined', function (activity, joinedUser) {

    SocialInteraction.dismissRecommendations(activity.idea, joinedUser, { reason: 'activityJoined' }, handleError);
    SocialInteraction.dismissInvitations(activity, joinedUser, { reason: 'activityJoined' }, handleError);

});


actMgr.on('activity:activityDeleted', function (activity) {
    SocialInteraction.deleteSocialInteractions(activity, handleError);
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

function handleError(err) {
    if (err) {
        return actMgr.emit('error', err);
    }
}

actMgr.on('error', function (err) {
    log.error(err);
    throw new Error(err);
});


module.exports = actMgr;
