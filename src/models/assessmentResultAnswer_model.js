var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');

var AssessmentResultAnswerSchema = common.newSchema({
        assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
        question: {type: Schema.Types.ObjectId, ref: 'AssessmentQuestion', required: true },
        answer: {type: Number, required: true, default: 0}
    }
);
module.exports = mongoose.model('AssessmentResultAnswer', AssessmentResultAnswerSchema);
