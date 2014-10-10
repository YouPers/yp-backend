/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    ObjectId = mongoose.Schema.ObjectId,
    auth = require('ypbackendlib').auth,
    enums = require('./enums');

/**
 * Idea Schema
 */
var CampaignSchema = common.newSchema({
    title: { type: String, trim: true, required: true },
    start: {type: Date, required: true },
    end: {type: Date, required: true },
    topic: {type: ObjectId, ref: 'Topic', required: true},
    organization:  { type: ObjectId, ref: 'Organization', required: true },
    participants: { type: String, trim: true},
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    slogan: { type: String, trim: true },
    paymentStatus: { type: String, trim: true, required: true, enum: enums.paymentStatus, default: "open", select: false },
    productType: { type: String, trim: true, required: true, enum: enums.campaignProductType, default: "CampaignProductType1", select: false },
    campaignLeads: [
        {type: ObjectId, ref: 'User'}
    ],
    avatar: {type: String}
});

CampaignSchema.statics.adminRoles =  [auth.roles.systemadmin, auth.roles.productadmin, auth.roles.campaignlead, auth.roles.orgadmin];

CampaignSchema.statics.adminAttrsSelector = '+productType +paymentStatus';

module.exports = mongoose.model('Campaign', CampaignSchema);
