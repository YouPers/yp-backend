/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common'),
    AssessmentResultAnswer = mongoose.model('AssessmentResultAnswer'),
    AssessmentQuestion = mongoose.model('AssessmentQuestion'),
    _ = require('lodash');

var AssessmentResultSchema = common.newSchema({
    owner: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    campaign: {type: Schema.Types.ObjectId, ref: 'Campaign'},
    assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
    timestamp: {type: Date},
    dirty: { type: Boolean },
    answers: [AssessmentResultAnswer.schema],
    needForAction: {} // using Mixed type because the keys of this object are dynamic (depend on categories of all questions)
});


AssessmentResultSchema.statics.getFieldDescriptions = function () {
    return {
        'answer.assessment': "reference to the assessment this answer belongs to",
        'answer.question': "reference to the question this answer belongs to",
        'answer.answer': "the actual answer to this question, minumum: -100, maximum: 100",
        owner: "reference to the user owning this Result",
        campaign: "reference to the campaign this result was entered in, used for statistics",
        assessment: "reference to the assessment this result belongs to",
        timestamp: "optional on POST, is filled by server when not submitted"
    };
};

var needForActionEvalFns = {
    "work": function(high, mid, low) {
        var need = 0;
        if (high >= 3) {
            need = 10;
        } else if (high >= 2) {
            need = 9;
        } else if (high >= 1 || mid >= 4) {
            need = 8;
        } else if (mid >= 3) {
            need = 7;
        } else if (mid >= 2) {
            need = 6;
        } else if (mid >= 1 || low >= 4) {
            need = 5;
        } else if (low >= 3) {
            need = 4;
        } else if (low >= 2) {
            need = 3;
        } else if (low >= 1) {
            need = 2;
        } else {
            need = 1;
        }
        return need;
    },
    "leisure": function(high, mid, low) {
        var need = 0;
        if (high >= 2) {
            need = 10;
        } else if (high >= 1 || mid >= 2) {
            need = 9;
        } else if (mid >= 1 || low >= 2) {
            need = 6;
        } else if (low >= 1) {
            need = 2;
        } else {
            need = 1;
        }
        return need;
    },
    "handling": function(high, mid, low) {
        var need = 0;
        if (high >= 2) {
            need = 10;
        } else if (high >= 1 || mid >= 2) {
            need = 9;
        } else if (mid >= 1 || low >= 2) {
            need = 6;
        } else if (low >= 1) {
            need = 2;
        } else {
            need = 1;
        }
        return need;
    },
    "stresstypus": function(high, mid, low) {
        var need = 0;
        if (high >= 2) {
            need = 10;
        } else if (high >= 1 || mid >= 3) {
            need = 9;
        } else if (mid >= 2) {
            need = 2;
        } else if (mid >= 1 || low >= 3) {
            need = 6;
        } else if (low >= 2) {
            need = 2;
        } else if (low >= 1) {
            need = 2;
        } else {
            need = 1;
        }
        return need;
    }
};

var questionsByIdCache;

AssessmentResultSchema.pre('save', function (next) {
    var self = this;
    if (!questionsByIdCache) {
        AssessmentQuestion.find()
            .exec(function (err, questions) {
                if (err) {
                    return next(err);
                }
                questionsByIdCache = _.indexBy(questions, 'id');
                self.needForAction = _caluculateNeedForAction(self.answers, questionsByIdCache);
                return next();
            });
    } else {
        this.needForAction = _caluculateNeedForAction(this.answers, questionsByIdCache);
        return next();
    }
});

function _caluculateNeedForAction(answers, questionsById) {
    var needForAction = {};
    var answersByCats = _.groupBy(answers, function (answer) {
        return questionsById[answer.question].category;
    });

    _.forEach(answersByCats, function (answers, catName) {

        var countNormalizedValues = _.countBy(answers, function (answerObj) {
            var normalizedValue = null;
            if (Math.abs(answerObj.answer) >= 90) {
                normalizedValue = 'high';
            } else if (Math.abs(answerObj.answer) >= 40) {
                normalizedValue = 'mid';
            } else if (Math.abs(answerObj.answer) >= 1) {
                normalizedValue = 'low';
            } else if (answerObj.answer === 0) {
                normalizedValue = 'none';
            } else {
                throw new Error('should never arrive here');
            }
            return normalizedValue;
        });



        needForAction[catName] = needForActionEvalFns[catName](countNormalizedValues['high'],
            countNormalizedValues['mid'],
            countNormalizedValues['low']);
    });

    return needForAction;
}


AssessmentResultSchema.calcNeedForActionFn = _caluculateNeedForAction;

module.exports = mongoose.model('AssessmentResult', AssessmentResultSchema);