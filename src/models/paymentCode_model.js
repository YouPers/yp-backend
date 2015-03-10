/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    enums = require('./enums');

/**
 * PaymentCode Schema
 * @type {Schema}
 */
var PaymentCodeSchema = common.newSchema({

    code: {type: String},
    strippedCode: {type: String},

    campaign: {type: ObjectId, ref: 'Campaign'},

    topic: { type: ObjectId, ref: 'Topic', required: true },
    productType: { type: String, enum: enums.campaignProductType, required: true },
    users: { type: Number },
    author: {type: ObjectId, ref: 'User', required: true},
    marketPartner: {type: ObjectId, ref: 'MarketPartner'},
    endorsementType: {type: String, enum: ["sponsored", "presented"]},
    orderNumber: {type: String}
});

module.exports = mongoose.model('PaymentCode', PaymentCodeSchema);
