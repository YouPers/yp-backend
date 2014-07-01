var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var _ = require('lodash');
var Notification = require('../core/Notification');
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


var actMgr = new ActivityManagement();

actMgr.on('activity:planSaved', function (plan) {
    var isCampaignPromotedPlan = (plan.source === "campaign");
    var isJoinablePlan = (_.contains(['public', 'campaign'], plan.visibility) && 'group' === plan.executionType );

    // check whether this is a public joinable plan, if yes store an corresponding invitation
    // but if this a campaign Promoted Plan we do not generate an invitation because we expect the frontend to
    // store the invitation explicitly in this case, to control all attributes of the invitation
    if (isJoinablePlan && !isCampaignPromotedPlan) {
        // TODO: do we still want this anyway? the owner would currently see an invitation for his own plan
        SocialInteraction.emit('invitation:activityPlan', plan.owner, plan.campaign, plan);
    }

    // find and dismiss all health coach recommendations for this idea

    // TODO: only health coach or from all other users as well

    // TODO: alternative approach: generateAndStoreRecommendations here as well

    SocialInteraction.dismissRecommendations(plan.idea, plan.owner);
});

actMgr.on('activity:planJoined', function (plan, joinedUser) {

    SocialInteraction.dismissRecommendations(plan.idea, joinedUser, handleError);
    SocialInteraction.dismissInvitations(plan, joinedUser, handleError);

});


actMgr.on('activity:planDeleted', function (plan) {

    SocialInteraction.dismissInvitations(plan, SocialInteraction.allUsers, handleError);
});

actMgr.on('activity:planUpdated', function(updatedPlan) {
    Invitation.find({
            refDocs: { $elemMatch: { docId: updatedPlan._id, model: 'ActivityPlan' }}
        }
    ).exec(function (err, invitations) {
        _.forEach(invitations, function (invitation) {
            // The publishTo of the invitation has to be equal or earlier than the last event,
            // it does not make sense to invite something that has already happened.
            if (invitation.publishTo > updatedPlan.lastEventEnd) {
                invitation.publishTo = updatedPlan.lastEventEnd;
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
