/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common');


/**
 * Activity Schema
 */

var question = common.newSchema({
    "category": String,
    "title": {type: String, required: true},
    "type": {type: String, enum: common.enums.questionType},
    "mintext": String,
    "mintextexample": String,
    "mintextresult": String,
    "midtext": String,
    "midtextexample": String,
    "maxtext": String,
    "maxtextexample": String,
    "maxtextresult": String,
    "exptext": String
});


var AssessmentSchema = common.newSchema({
    name: {type: String, trim: true, required: true},
    questionCats: [
        { category: {type: String, required: true},
            questions: [question]}
    ]
});

AssessmentSchema.statics.getFieldDescriptions = function() {
    return {
        name: 'name of this assessment',
        questionCats: 'An array of question-Categories, each category contains a list of questions',
        'questionCat.category': 'The category title of this category',
        'questionsCat.questions': 'The list of questions in this category',
        'question.title': 'The title of this question',
        'question.category': 'The category title this question belongs to'
    };
};

module.exports = mongoose.model('Assessment', AssessmentSchema);

common.initializeDbFor(mongoose.model('Assessment'));