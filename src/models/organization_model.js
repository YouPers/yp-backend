/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('ypbackendlib').commmonModels,
    ObjectId = mongoose.Schema.ObjectId,
    auth = require('ypbackendlib').auth;

/**
 * Organization Schema
 */
var OrganizationSchema = common.newSchema({
    name: { type: String, trim: true, required: true },
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
    },

    administrators: {type: [{ type: ObjectId, ref: 'User'}]},
    avatar: {type: String}
});

OrganizationSchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin, auth.roles.orgadmin];

module.exports = mongoose.model('Organization', OrganizationSchema);

