/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;

/**
 * Activity Schema
 */
var CampaignSchema = common.newSchema({
    title: { type: String, trim: true, required: true },
    topic: {type: String, trim: true},
    healthPromoter: {type: ObjectId},
    start: {type: Date},
    end: {type: Date},
    stats: {}
});


mongoose.model('Campaign', CampaignSchema);

common.initializeDbFor(mongoose.model('Campaign'));