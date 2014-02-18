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
    start: {type: Date, required: true },
    end: {type: Date, required: true },
    relatedService: {type: String, trim: true, enum: common.enums.relatedService, default: "YP-Balance"},
    organization:  { type: ObjectId, ref: 'Organization', required: true },
    location: { type: String, trim: true, required: true },
    slogan: { type: String, trim: true },
    paymentStatus: { type: String, trim: true, required: true, enum: common.enums.paymentStatus, default: "open", select: "false" },
    productType: { type: String, trim: true, required: true, enum: common.enums.campaignProductType, default: "CampaignProductType1", select: false },
    campaignLeads: [
        {type: ObjectId, ref: 'User'}
    ]
});

var model = mongoose.model('Campaign', CampaignSchema);

module.exports = mongoose.model('Campaign');

common.initializeDbFor(model);