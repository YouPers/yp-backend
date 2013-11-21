/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId,
    statsUpdater = require('../logic/stats');

/**
 * Activity Schema
 */
var CampaignSchema = common.newSchema({
    title: { type: String, trim: true, required: true },
    topic: {type: String, trim: true},
    healthPromoter: {type: ObjectId},
    start: {type: Date},
    end: {type: Date},
    stats:  {}
});

mongoose.model('Campaign', CampaignSchema);

var model = mongoose.model('Campaign');

statsUpdater.on('newActivityPlan', function(newPlan) {
    console.log("updating stats for newPlan: "+ newPlan);
    if (!newPlan.campaign) {
        // nothing to do because this plan is not part of a campaign
        return;
    }

    model.findById(newPlan.campaign, function updateCampaignStats (err, campaign) {
        console.log("found campaign: " + campaign);
        if (err || !campaign) {
            throw new Error('Error on loading campaign: ' + newPlan.campaign + ' :' + err);
        }
        console.log("updating Campaign Stats because we have a new activityPlanned: " + newPlan);
    });
});

statsUpdater.on('updatedActivityEvent', function(oldEvent, newEvent, newPlan) {
    if (!newPlan.campaign) {
        // nothing to do because this plan is not part of a campaign
        return;
    }

    model.findById(newPlan.campaign, function updateCampaignStats (err, campaign) {
        if (err || !campaign) {
            throw new Error('Error on loading campaign: ' + newPlan.campaign + ' :' + err);
        }
        console.log("updating Campaign Stats because we have an updated ActivityEvent: " + newEvent);
    });
});



common.initializeDbFor(model);