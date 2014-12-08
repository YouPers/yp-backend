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

    campaign: {type: ObjectId},

    topic: { type: ObjectId, ref: 'Topic', required: true },
    productType: { type: String, enum: enums.campaignProductType, required: true },
    users: { type: Number }
});

module.exports = mongoose.model('PaymentCode', PaymentCodeSchema);
