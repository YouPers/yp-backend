var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var _ = require('lodash');
var User = mongoose.model('User');
var Invitation = mongoose.model('Invitation');
var SocialInteraction = require('../core/SocialInteraction');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
var Logger = require('bunyan');
var log = new Logger(config.loggerOptions);


function ActivityManagement() {
    EventEmitter.call(this);
}

util.inherits(ActivityManagement, EventEmitter);


User.on('change:campaign', function (user) {

    // TODO: plan self-assessment idea
});

var actMgr = new ActivityManagement();

actMgr.on('activity:activitySaved', function (activity) {

    // find and dismiss all health coach recommendations for this idea

    // TODO: only health coach or from all other users as well

    // TODO: alternative approach: generateAndStoreRecommendations here as well

    SocialInteraction.dismissRecommendations(activity.idea, activity.owner);
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
