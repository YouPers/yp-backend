/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Activity Schema
 */
var ActivitySchema = new Schema({
    id: ObjectId,
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true, required: true },
    source: { type: String, enum: common.enums.source},
    defaultplantype: {type: String, enum: common.enums.plantype},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultvisibility: {type: String, enum: common.enums.visibility},
    topic: [String],
    field: [String]
});


mongoose.model('Activity', ActivitySchema);

common.initializeDbFor(mongoose.model('Activity'));