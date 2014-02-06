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
    "title": {type: String, i18n: true},
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

var questionCatsSchema = common.newSchema({ category: {type: String, required: true},
    questions: [question]});

var AssessmentSchema = common.newSchema({
    name: {type: String, trim: true, i18n: true},
    questionCats: [questionCatsSchema]
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

mongoose.model('AssessmentQuestion', question);

module.exports = mongoose.model('Assessment', AssessmentSchema);



common.initializeDbFor(mongoose.model('Assessment'));