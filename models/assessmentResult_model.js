/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 * Activity Schema
 */


var AssessmentResultSchema = new Schema({
    owner: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
    timestamp: {type: Date},
    answers: [{assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
               question: {type: Schema.Types.ObjectId, required: true },
               answer: {type: Number, required: true, default: 0},
               answered: {type: Boolean, required: true, default: false}}
    ]
});


mongoose.model('AssessmentResult', AssessmentResultSchema);