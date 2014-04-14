var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var ActivityOffer = mongoose.model('ActivityOffer');
var _ = require('lodash');
var urlComposer = require('../util/urlcomposer');
var Notification = require('../core/Notification');
var NotificationModel = require('../models/notification_model');

var mapOfferTypeToNotificationType = {
    'campaignActivityPlan': 'joinablePlan',
    'publicActivityPlan': 'joinablePlan',
    'campaignActivity': 'activityRecommendation',
    'personalInvitation': 'personalInvitation',
    'ypHealthCoach': 'activityRecommendation'
};

var mapOfferTypeToNotificationSourceType = {
    'campaignActivityPlan': 'campaign',
    'campaignActivity': 'campaign',
    'personalInvitation': 'community',
    'ypHealthCoach': 'youpers',
    'publicActivityPlan': 'community'
};

function ActivityManagement() {
    EventEmitter.call(this);
}

util.inherits(ActivityManagement, EventEmitter);


var actMgr = new ActivityManagement();

actMgr.on('activity:planSaved', function (plan) {
    var isCampaignPromotedPlan = (plan.source === "campaign");
    var isJoinablePlan = (_.contains(['public', 'campaign'], plan.visibility) && 'group' === plan.executionType && !plan.masterPlan);

    // check whether this is a public joinable plan, if yes store an corresponding ActivityOffer
    if (isJoinablePlan) {
        var offer = new ActivityOffer({
            activity: plan.activity.id,
            activityPlan: [plan.id],
            targetQueue: plan.campaign || plan.owner, // TODO: This || plan.owner is a hack to prevent "public" offers to show up in multiple campaigns. Need to decide on how to deal with real PUBLIC offer
            recommendedBy: [plan.owner],
            type: [isCampaignPromotedPlan ? 'campaignActivityPlan' : 'publicActivityPlan'],
            validTo: plan.events[plan.events.length - 1].end,
            prio: [isCampaignPromotedPlan ? 500 : 1]
        });
        offer.save(function (err, savedOffer) {
            if (err) {
                return actMgr.emit('error', err);
            }
            return actMgr.emit('activity:offerSaved', savedOffer, plan);
        });
    }

    // TODO: check whether we need to delete any offers / notifications as the user has planned this activity now
    // Assumption:
    // - We delete any personal offers and personal notifications for the same user and for the same masterplan
    var isSlavePlan = plan.masterPlan;

    if (isSlavePlan) {
        ActivityOffer
            .find({targetQueue: plan.owner, activityPlan: plan.masterPlan})
            .exec(function(err, offers) {
                _.forEach(offers, function (offer) {
                    actMgr.emit('activity:offerDeleted', offer);
                    offer.remove(function (err) {
                        if (err) {
                            return actMgr.emit('error', err);
                        }
                    });
                });
            });
    }
});


actMgr.on('activity:planDeleted', function (plan) {
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
    if (!(offer.activity instanceof mongoose.model('Activity'))) {
        offer.populate('activity activityPlan', _publishNotification);
    } else {
        _publishNotification(null, offer);
    }

    function _publishNotification(err, offer) {
        if (err) {
            return actMgr.emit('Error', err);
        }
        var isCampaignPromotedOffer = ((offer.type[0] === 'campaignActivityPlan') || (offer.type[0] === 'campaignActivity'));
        var isPersonalInvite = (offer.type[0] === 'personalInvitation');

        if (isCampaignPromotedOffer || isPersonalInvite) {
            return new Notification({
                type: mapOfferTypeToNotificationType[offer.type],
                sourceType: mapOfferTypeToNotificationSourceType[offer.type],
                title: (offer.plan && offer.plan.title) || offer.activity.title,
                targetQueue: offer.targetQueue,
                author: offer.recommendedBy,
                refDocLink: urlComposer.activityOfferUrl(offer.activity.id),
                refDocId: offer._id,
                refDocModel: 'ActivityOffer',
                publishTo: offer.validTo
            }).
                publish(function (err) {
                    if (err) {
                        return actMgr.emit('error', err);
                    }
                });
        }
    }
});

actMgr.on('activity:offerDeleted', function (offer) {
    // check whether there are any notifications to be deleted
    NotificationModel
        .find({refDocId: offer._id})
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


actMgr.on('error', function(err) {
    // TODO: do real error handling
    console.log(err);
    throw new Error(err);
});


module.exports = actMgr;
