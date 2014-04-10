/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');

var AssessmentResultAnswerSchema = common.newSchema({
        assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
        question: {type: Schema.Types.ObjectId, required: true },
        answer: {type: Number, required: true, default: 0},
        answered: {type: Boolean, required: true, default: false}
    }
);
module.exports = mongoose.model('AssessmentResultAnswer', AssessmentResultAnswerSchema);


var AssessmentResultSchema = common.newSchema({
    owner: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    campaign: {type: Schema.Types.ObjectId, ref: 'Campaign'},
    assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
    timestamp: {type: Date},
    answers: [AssessmentResultAnswerSchema]
});


AssessmentResultSchema.statics.getFieldDescriptions = function() {
    return {
        'answer.assessment': "reference to the assessment this answer belongs to",
        'answer.question': "reference to the question this answer belongs to",
        'answer.answer': "the actual answer to this question, minumum: -100, maximum: 100",
        owner:  "reference to the user owning this Result",
        campaign: "reference to the campaign this result was entered in, used for statistics",
        assessment:  "reference to the assessment this result belongs to",
        timestamp: "optional on POST, is filled by server when not submitted"
    };
};

module.exports = mongoose.model('AssessmentResult', AssessmentResultSchema);