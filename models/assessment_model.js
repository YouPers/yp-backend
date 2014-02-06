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
    "title": {type: String},
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

question.methods.i18nAttrs = ['title', 'mintext', 'mintextexample', 'mintextresult', 'midtext',
    'midtextexample', 'maxtext', 'maxtextexample', 'maxtextresult', 'exptext'];

var questionCatsSchema = common.newSchema({ category: {type: String, required: true},
    questions: [question]});

    questionCatsSchema.methods.i18nAttrs = ['questions'];

var AssessmentSchema = common.newSchema({
    name: {type: String, trim: true},
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

AssessmentSchema.methods.i18nAttrs = ['name', 'questionCats'];

mongoose.model('AssessmentQuestion', question);

module.exports = mongoose.model('Assessment', AssessmentSchema);



common.initializeDbFor(mongoose.model('Assessment'));