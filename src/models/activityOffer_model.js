/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;


/**
 * ActivityOffer Schema
 */
var ActivityOfferSchema = common.newSchema({
    activity: {type: ObjectId, ref: 'Activity', required: true},
    activityPlan: [{type: ObjectId, ref: 'ActivityPlan', required: false}],
    type: [{type: String}],
    targetCampaign: {type: ObjectId, ref: 'Campaign', required: false},
    targetUser: {type: ObjectId, ref: 'User', required: false},
    recommendedBy: [{type: ObjectId, ref: 'User', required: true}],
    prio: [{type: Number}],
    validFrom: {type: Date, required: false},
    validTo: {type: Date, required: false}
});

module.exports = mongoose.model('ActivityOffer', ActivityOfferSchema);

common.initializeDbFor(mongoose.model('ActivityOffer'));