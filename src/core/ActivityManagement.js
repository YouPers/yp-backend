var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var ActivityOffer = mongoose.model('ActivityOffer');
var _ = require('lodash');
var urlComposer = require('../util/urlcomposer');
var Notification = require('../core/Notification');
var NotificationModel = require('../models/notification_model');
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

    // check whether this is a public joinable plan, if yes store an corresponding ActivityOffer
    // but if this a campaign Promoted Plan we do not generate an offer because we expect the frontend to
    // store the offer explicitly in this case, to control all attributes of the offer
    if (isJoinablePlan && !isCampaignPromotedPlan) {
        var offer = new ActivityOffer({
            idea: plan.idea.id || plan.idea,
            activityPlan: [plan.id],
            targetQueue: plan.campaign || plan.owner, // TODO: This || plan.owner is a hack to prevent "public" offers to show up in multiple campaigns. Need to decide on how to deal with real PUBLIC offer
            recommendedBy: [plan.owner],
            offerType: ['publicActivityPlan'],
            validTo: plan.lastEventEnd,
            prio: [1]
        });
        offer.save(function (err, savedOffer) {
            if (err) {
                return actMgr.emit('error', err);
            }
            return actMgr.emit('activity:offerSaved', savedOffer, plan);
        });
    }

    // find and dismiss all health coach recommendations for this idea

    // TODO: only health coach or from all other users as well

    // TODO: alternative approach: generateAndStoreRecommendations here as well

    SocialInteraction.dismissRecommendations(plan.idea, plan.owner);


    // find all notification for (this user or this user's campaign) and idea, dismiss them for this user

    NotificationModel
        .find({refDocs: { $elemMatch: { docId: plan.idea._id }}})
        .and({$or: [{ targetQueue: plan.owner }, { targetQueue: plan.campaign }]})
        .exec(function(err, notifs) {
            _.forEach(notifs, function(notif) {

                Notification.dismissNotification(notif.id, plan.owner, function(err) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                });
            });
        });
});

actMgr.on('activity:planJoined', function (plan, joinedUser) {

    SocialInteraction.dismissRecommendations(plan.idea, joinedUser, handleError);
    SocialInteraction.dismissInvitations(plan, joinedUser, handleError);

});


actMgr.on('activity:planDeleted', function (plan) {


    SocialInteraction.dismissInvitations(plan, SocialInteraction.allUsers, handleError);

    // remove any offers to join this plan
    ActivityOffer.find({activityPlan: plan._id}).exec(function (err, offers) {
        _.forEach(offers, function (offer) {
            actMgr.emit('activity:offerDeleted', offer);
            offer.remove(function (err) {
                if (err) {
                    return actMgr.emit('error', err);
                }
            });
        });
    });
});

actMgr.on('activity:offerSaved', function (offer) {

    // check if offer is populated, if not load the missing referenced objects so we can create nice notifications
    if (!(offer.idea instanceof mongoose.model('Idea'))) {
        offer.populate('idea activityPlan', _publishNotification);
    } else {
        _publishNotification(null, offer);
    }

    function _publishNotification(err, offer) {
        if (err) {
            return actMgr.emit('Error', err);
        }
        var isCampaignPromotedOffer = ((offer.offerType[0] === 'campaignActivityPlan') || (offer.offerType[0] === 'campaignActivity'));
        var isPersonalInvite = (offer.offerType[0] === 'personalInvitation');
        var isPublicPlan = (offer.offerType[0] === 'publicActivityPlan');

        if (isCampaignPromotedOffer || isPersonalInvite) {
            var notification = new Notification({
                type: ActivityOffer.mapOfferTypeToNotificationType[offer.offerType[0]],
                sourceType: ActivityOffer.mapOfferTypeToSourceType[offer.offerType[0]],
                title: (offer.plan && offer.plan.title) || offer.idea.title,
                targetQueue: offer.targetQueue,
                author: offer.recommendedBy,
                refDocLink: urlComposer.activityOfferUrl(offer.idea.id),
                refDocs: [ { docId: offer._id, model: 'ActivityOffer' }, { docId: offer.idea._id, model: 'Idea' } ],
                publishFrom: offer.validFrom,
                publishTo: offer.validTo
            });
            if(offer.plan) {
                notification.push({ docId: offer.plan.id, model: 'ActivityPlan' });
            }

            return notification.
                publish(function (err) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                });
        } else if (isPublicPlan){
            // this is a public plan, we do not genereate Notifications for these
        } else {
            throw new Error('unknown offertype: ' + offer.offerType[0]);
        }
    }
});

actMgr.on('activity:offerDeleted', function (offer) {
    // check whether there are any notifications to be deleted
    NotificationModel
        .find({refDocs: {$elemMatch: {docId: offer._id }}})
        .exec(function(err, notifs) {
            _.forEach(notifs, function(notif) {
                notif.remove(function (err) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                });
            });
        });
});


actMgr.on('activity:offerUpdated', function (offer) {
    // check whether there are any notifications to be deleted
    NotificationModel
        .find({refDocs: {$elemMatch: {docId: offer._id }}})
        .exec(function(err, notifs) {
            _.forEach(notifs, function(notif) {
                notif.publishFrom = offer.validFrom;
                notif.publishTo = offer.validTo;
                notif.save(function(err, savedNotif) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                });
            });
        });
});

actMgr.on('activity:planUpdated', function(updatedPlan) {
    ActivityOffer.find({activityPlan: updatedPlan._id}).exec(function (err, offers) {
        _.forEach(offers, function (offer) {
            // The validTo of the offer has to be equal or earlier than the last event,
            // it does not make sense to offer something that has already happened.
            if (offer.validTo > updatedPlan.lastEventEnd) {
                offer.validTo = updatedPlan.lastEventEnd;
                offer.save(function (err, updatedOffer) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                    actMgr.emit('activity:offerUpdated', updatedOffer);
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
