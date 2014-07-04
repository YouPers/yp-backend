/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * PaymentCode Schema
 * @type {Schema}
 */
var PaymentCodeSchema = common.newSchema({

    code: {type: String},

    campaign: {type: ObjectId},

    topic: { type: ObjectId, ref: 'Topic', required: true },
    productType: { type: String, enum: common.enums.campaignProductType, required: true },
    users: { type: Number }
});

module.exports = mongoose.model('PaymentCode', PaymentCodeSchema);
