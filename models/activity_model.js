/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common');

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
    topics: [String],
    fields: [String]
});


mongoose.model('Activity', ActivitySchema);

common.initializeDbFor(mongoose.model('Activity'));