var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var _ = require('lodash');
var moment = require('moment');
var User = mongoose.model('User');
var Invitation = mongoose.model('Invitation');
var Idea = mongoose.model('Idea');
var Activity = mongoose.model('Activity');
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
                handleError(err);
                var assessmentActivity = actMgr.defaultActivity(idea, user);
                assessmentActivity.save(handleError);
            });
        }
    });
});

actMgr.defaultActivity = function(idea, user) {
    var now = moment();
    var mainEvent = {
        "allDay": false
    };
    var duration = idea.defaultduration ? idea.defaultduration : 60;
    if (idea.defaultfrequency === 'week') {
        mainEvent.start = moment(now).startOf('hour').toDate();
        mainEvent.end = moment(mainEvent.start).add(duration, 'm').toDate();
        mainEvent.frequency = 'week';
        mainEvent.recurrence = {
            "endby": {
                "type": "after",
                "after": 6
            },
            every: 1
        };
    } else if (idea.defaultfrequency === 'day') {
        mainEvent.start = moment(now).add(1, 'd').startOf('hour').toDate();
        mainEvent.end = moment(mainEvent.start).add(duration, 'm').toDate();
        mainEvent.frequency = 'day';
        mainEvent.recurrence = {
            "endby": {
                "type": "after",
                "after": 3
            },
            byday: user.profile.prefs.defaultWorkWeek,
            every: 1
        };
    } else { // default is "once"
        mainEvent.start = moment(now).add(1, 'd').startOf('hour').toDate();
        mainEvent.end = moment(mainEvent.start).add(duration, 'm').toDate();
        mainEvent.frequency = 'once';
        mainEvent.recurrence = {
            "endby": {
                "type": "after",
                "after": 3
            },
            every: 1
        };
    }

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
    SocialInteraction.dismissRecommendations(activity.idea, activity.owner);
});

actMgr.on('activity:activitySaved', function (activity) {


});

actMgr.on('activity:activityJoined', function (activity, joinedUser) {

    SocialInteraction.dismissRecommendations(activity.idea, joinedUser, handleError);
    SocialInteraction.dismissInvitations(activity, joinedUser, handleError);

});


actMgr.on('activity:activityDeleted', function (activity) {

    SocialInteraction.dismissInvitations(activity, SocialInteraction.allUsers, handleError);
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
