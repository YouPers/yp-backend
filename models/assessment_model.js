/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');


/**
 * Activity Schema
 */

var question = new Schema({
    "category": String,
    "title": String,
    "type": {type: String, enum: common.enums.questionType},
    "mintext": String,
    "midtext": String,
    "maxtext": String,
    "exptext": String
});


var AssessmentSchema = new Schema({
    name: {type: String, trim: true, required: true},
    questionCats: [
        { category: String,
            questions: [question]}
    ]
});


mongoose.model('Assessment', AssessmentSchema);

common.initializeDbFor(mongoose.model('Assessment'));