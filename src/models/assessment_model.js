/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    auth = require('ypbackendlib').auth,
    ObjectId = mongoose.Schema.ObjectId,
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
    name: {type: String, trim: true, i18n: true, required: true},
    impactQuestion: {type: String, trim: true, i18n: true, required: true},
    impactQuestionLeft: {type: String, trim: true, i18n: true, required: true},
    impactQuestionRight: {type: String, trim: true, i18n: true, required: true},
    questions: [{type: ObjectId, ref: 'AssessmentQuestion'}],
    topic: {type: ObjectId, ref: 'Topic', required: true},
    idea: {type: ObjectId, ref: 'Idea', required: false}
});

AssessmentSchema.statics.getSwaggerModel = function () {
    return _.merge(common.getSwaggerModel(this), common.getSwaggerModel(mongoose.model('AssessmentQuestion')));
};


AssessmentSchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin];

mongoose.model('AssessmentQuestion', AssessmentQuestionSchema);

module.exports = mongoose.model('Assessment', AssessmentSchema);