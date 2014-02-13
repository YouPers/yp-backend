/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;

/**
 * Organization Schema
 */
var OrganizationSchema = common.newSchema({
    name: { type: String, trim: true, required: true },
    location: {type: String, trim: true},
    sector: {type: String, trim: true},
    nrOfEmployees: {type: String, trim: true},
    administrators: {type: [{ type: ObjectId, ref: 'User'}]},
    avatar: {type: String}
});

var model = mongoose.model('Organization', OrganizationSchema);

module.exports = mongoose.model('Organization');



common.initializeDbFor(model);