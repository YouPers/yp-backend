/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;


/**
 * ActivityOffer Schema
 *
 * We use arrays for the properties 'activityPlan', 'type', 'recommendedBy' and 'prio' because we deliver to the
 * clients a consolidated Offers list by activity - meaning, for each activity there is at most one Offer in the API,
 * but this offer may contain multiple 'activityPlan', 'type', 'recommendedBy' and 'prio'.
 *
 * In the Database we usually store them 'not-consolidated', so from a mongo point of view we could use
 * non-array properties, but since we use the same object in the API we chose the model it like this.
 */
var ActivityOfferSchema = common.newSchema({
    activity: {type: ObjectId, ref: 'Activity', required: true},
    activityPlan: [{type: ObjectId, ref: 'ActivityPlan', required: false}],
    type: [{type: String}],  // mongoose does not allows String enum inside []--> only use common.enums.ActivityOfferType here!!!
    targetQueue: {type: ObjectId, required: true},
    recommendedBy: [{type: ObjectId, ref: 'User', required: true}],
    prio: [{type: Number}],
    validFrom: {type: Date, required: false},
    validTo: {type: Date, required: false}
});

// TODO: add custom validation for the enum, since mongoose does not support array of strings with the strings being part of an enum.

module.exports = mongoose.model('ActivityOffer', ActivityOfferSchema);
