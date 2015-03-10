/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    auth = require('ypbackendlib').auth;

/**
 * Organization Schema
 */
var MarketPartnerSchema = common.newSchema({
    name: { type: String, trim: true, required: true },
    logo: {type: String},
    byline: {type: String},
    address: {
        street: {type: String, trim: true},
        zipCode: {type: String, trim: true},
        city: {type: String, trim: true}
    },
    legalForm: {type: String, trim: true},
    sector: {type: String, trim: true},

    contact: {
        position: {type: String, trim: true},
        phone: {type: String, trim: true}
    }
});

MarketPartnerSchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin];

module.exports = mongoose.model('MarketPartner', MarketPartnerSchema);

