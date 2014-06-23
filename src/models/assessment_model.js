/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    auth = require('../util/auth'),
    ObjectId = mongoose.Schema.ObjectId,
    swaggerAdapter = require('../util/swaggerMongooseAdapter'),
    _ = require('lodash');

/**
 * Idea Schema
 */

var AssessmentQuestionSchema = common.newSchema({
    "category": String,
    "assessment": {type: ObjectId},
    "title": {type: String, required: true, i18n: true},
    "type": {type: String, enum: common.enums.questionType},
    "mintext": {type: String, i18n: true},
    "mintextexample": {type: String, i18n: true},
    "mintextresult": {type: String, i18n: true},
    "midtext": {type: String, i18n: true},
    "midtextexample": {type: String, i18n: true},
    "maxtext": {type: String, i18n: true},
    "maxtextexample": {type: String, i18n: true},
    "maxtextresult": {type: String, i18n: true},
    "exptext": {type: String, i18n: true}
});

var AssessmentSchema = common.newSchema({
    name: {type: String, trim: true, i18n: true},
    questions: [{type: ObjectId, ref: 'AssessmentQuestion'}]
});

AssessmentSchema.statics.getSwaggerModel = function () {
    return _.merge(swaggerAdapter.getSwaggerModel(this), swaggerAdapter.getSwaggerModel(mongoose.model('AssessmentQuestion')));
};


AssessmentSchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin];

mongoose.model('AssessmentQuestion', AssessmentQuestionSchema);

module.exports = mongoose.model('Assessment', AssessmentSchema);