var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var _ = require('lodash');
var moment = require('moment');
var calendar = require('../util/calendar');
var User = mongoose.model('User');
var Invitation = mongoose.model('Invitation');
var Idea = mongoose.model('Idea');
var Activity = mongoose.model('Activity');
var ActivityEvent = mongoose.model('ActivityEvent');
var SocialInteraction = require('../core/SocialInteraction');
var log = require('../util/log').logger;
var ASSESSMENT_IDEA = "5278c6accdeab69a25000008";

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

User.on('change:campaign', function(user) {
    Activity.find({
        owner: user._id,
        idea: ASSESSMENT_IDEA,
        status: 'active'
    }).exec(function (err, activities) {
        handleError(err);

        // only plan assessment idea if there is no active activity yet
        if(activities.length === 0) {
            Idea.findById(ASSESSMENT_IDEA, function(err, idea) {
                if(err) {
                    return handleError(err);
                }
                var assessmentActivity = actMgr.defaultActivity(idea, user);
                assessmentActivity.save(function(err, savedActivity) {
                    if(err) {
                        return handleError(err);
                    }
                    var events = actMgr.getEvents(savedActivity, user.id);
                    ActivityEvent.create(events, function (err) {
                        if(err) {
                            return handleError(err);
                        }
                        actMgr.emit('activity:activityCreated', savedActivity);
                    });
                });

            });
        }
    });
});


actMgr.getEvents = function getEvents(activity, ownerId, fromDate) {

    var duration = moment(activity.mainEvent.end).diff(activity.mainEvent.start);

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

actMgr.defaultActivity = function(idea, user) {
    var now = moment();
    var mainEvent = {
        "allDay": false
    };
    var duration = idea.defaultduration ? idea.defaultduration : 60;

    mainEvent.start = moment(now).add(1, 'd').startOf('hour').toDate();
    mainEvent.end = moment(mainEvent.start).add('m', duration).toDate();
    mainEvent.frequency = idea.defaultfrequency;
    mainEvent.recurrence = {
        "endby": {
            "type": "after",
            "after": 3
        },
        byday: user.profile.prefs && user.profile.prefs.defaultWorkWeek || undefined,
        every: 1
    };

    var campaignId = user.campaign._id || user.campaign;

    var activity = {
        owner: user._id || user,
        idea: idea,
        status: 'active',
        mainEvent: mainEvent,
        source: campaignId ? 'campaign' : 'community',
        executionType: idea.defaultexecutiontype,
        visibility: campaignId ? 'campaign' : idea.defaultvisibility,
        fields: idea.fields,
        topics: idea.topics,
        title: idea.title,
        number: idea.number
    };

    if (campaignId) {
        activity.campaign = campaignId;
    }
    var activityModel = new Activity(activity);

    // repopulate idea
    activityModel.idea = idea;

    return  activityModel;
};


actMgr.on('activity:activityCreated', function (activity) {

    if(!activity.private) {

        // we need the model for the recipient targetSpace, create pseudo model instead of loading the campaign
//        var campaign = activity.campaign instanceof mongoose.Types.ObjectId ? {
//            _id: activity.campaign,
//            constructor: { modelName: 'Campaign' }
//        } : activity.campaign;


        //TODO: WIP, disabled for now, as it destroys the tests
//        SocialInteraction.emit('invitation:activity', activity.owner, campaign, activity);
    }

    // find and dismiss all health coach recommendations for this idea
    // TODO: only health coach or from all other users as well
    SocialInteraction.dismissRecommendations(activity.idea, activity.owner, { reason: 'activityScheduled'});
});

actMgr.on('activity:activitySaved', function (activity) {


});

actMgr.on('activity:activityJoined', function (activity, joinedUser) {

    SocialInteraction.dismissRecommendations(activity.idea, joinedUser, { reason: 'activityJoined' }, handleError);
    SocialInteraction.dismissInvitations(activity, joinedUser, { reason: 'activityJoined' }, handleError);

});


actMgr.on('activity:activityDeleted', function (activity) {

    SocialInteraction.dismissInvitations(activity, SocialInteraction.allUsers, { reason: 'activityDeleted' }, handleError);
});

actMgr.on('activity:activityUpdated', function(updatedActivity) {
    Invitation.find({
            refDocs: { $elemMatch: { docId: updatedActivity._id, model: 'Activity' }}
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
    if(err) {
        return actMgr.emit('error', err);
    }
}

actMgr.on('error', function(err) {
    log.error(err);
    throw new Error(err);
});


module.exports = actMgr;
