/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;

/**
 * Activity Schema
 */
var ActivitySchema = common.newSchema({
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true },
    text: {type: String, trim: true},
    source: { type: String, enum: common.enums.source},
    defaultfrequency: {type: String, enum: common.enums.ActivityPlanFrequency},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultvisibility: {type: String, enum: common.enums.visibility},
    defaultduration: {type: Number},
    topics: [String],
    fields: [String],
    qualityFactor: {type: Number, select: false},
    recWeights: {type: [
        {question: {type: ObjectId},
            negativeAnswerWeight: {type: Number},
            positiveAnswerWeight: {type: Number}}
    ], select: false}
});

ActivitySchema.statics.getAdminAttrsSelector = function () {
    return '+recWeights +qualityFactor';
};

ActivitySchema.methods.i18nAttrs = ['title', 'text'];

module.exports = mongoose.model('Activity', ActivitySchema);

common.initializeDbFor(mongoose.model('Activity'));