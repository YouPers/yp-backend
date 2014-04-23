/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId,
    auth = require('../util/auth');

/**
 * Activity Schema
 */
var CampaignSchema = common.newSchema({
    title: { type: String, trim: true, required: true },
    start: {type: Date, required: true },
    end: {type: Date, required: true },
    relatedService: {type: String, trim: true, enum: common.enums.relatedService, default: "YP-Balance"},
    organization:  { type: ObjectId, ref: 'Organization', required: true },
    participants: { type: String, trim: true},
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    slogan: { type: String, trim: true },
    paymentStatus: { type: String, trim: true, required: true, enum: common.enums.paymentStatus, default: "open", select: false },
    productType: { type: String, trim: true, required: true, enum: common.enums.campaignProductType, default: "CampaignProductType1", select: false },
    campaignLeads: [
        {type: ObjectId, ref: 'User'}
    ],
    avatar: {type: String}
});

CampaignSchema.statics.adminRoles =  [auth.roles.systemadmin, auth.roles.productadmin, auth.roles.campaignlead, auth.roles.orgadmin];

CampaignSchema.statics.adminAttrsSelector = '+productType +paymentStatus';

module.exports = mongoose.model('Campaign', CampaignSchema);
