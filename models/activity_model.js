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
    title: { type: String, trim: true, required: true },
    source: { type: String, enum: common.enums.source},
    defaultfrequency: {type: String, enum: common.enums.activityPlannedFrequency},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultvisibility: {type: String, enum: common.enums.visibility},
    defaultduration: {type: Number},
    topics: [String],
    fields: [String],
    qualityFactor: Number,
    recWeights: [{question: {type: ObjectId},
                  negativeAnswerWeight: {type: Number},
                  positiveAnswerWeight: {type: Number}}]
    //TODO: (Rblu) only deliver recWeights to client in case of role admin, otherwise hide on server!!!
});


mongoose.model('Activity', ActivitySchema);

common.initializeDbFor(mongoose.model('Activity'));