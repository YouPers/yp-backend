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

    service: { type: String, enum: common.enums.service },
    productType: { type: String, enum: common.enums.productType },
    users: { type: Number }
});


module.exports = mongoose.model('PaymentCode', PaymentCodeSchema);

common.initializeDbFor(mongoose.model('PaymentCode'));