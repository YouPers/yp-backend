/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    common = require('ypbackendlib').commmonModels,
    AssessmentResultAnswer = mongoose.model('AssessmentResultAnswer'),
    AssessmentQuestion = mongoose.model('AssessmentQuestion'),
    _ = require('lodash');

var AssessmentResultSchema = common.newSchema({
    owner: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    campaign: {type: Schema.Types.ObjectId, ref: 'Campaign'},
    topic: {type: Schema.Types.ObjectId, ref: 'Topic'},
    assessment: {type: Schema.Types.ObjectId, ref: 'Assessment', required: true},
    dirty: { type: Boolean },
    answers: [AssessmentResultAnswer.schema],
    needForAction: [{category: {type: String}, value: {type: Number}}]
});


AssessmentResultSchema.statics.getFieldDescriptions = function () {
    return {
        'answer.assessment': "reference to the assessment this answer belongs to",
        'answer.question': "reference to the question this answer belongs to",
        'answer.answer': "the actual answer to this question, minumum: -100, maximum: 100",
        owner: "reference to the user owning this Result",
        campaign: "reference to the campaign this result was entered in, used for statistics",
        assessment: "reference to the assessment this result belongs to"
    };
};

var needForActionEvalFns = {

    "default": function(high, mid, low) {
        var need = 0;
        if (high >= 1) {
            need = 10;
        } else if (mid >= 1) {
            need = 6;
        } else if (low >= 1) {
            need = 3;
        } else {
            need = 1;
        }
        return need;
    },

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

var questionsByIdCache = {};


function _updateQuestionsCache(cb) {
    AssessmentQuestion.find()
        .exec(function (err, questions) {
            if (err) {
                return cb(err);
            }
            questionsByIdCache = _.indexBy(questions, 'id');
            return cb();
        });
}



AssessmentResultSchema.pre('save', function (next) {
    var self = this;
    _calculateNeedForAction(this.answers, function (err, result) {
        self.needForAction = result;
        return next();
    });
});

function _getAnswersByCats(answers, cb) {
    try {
        var answersByCats = _.groupBy(answers, function (answer) {
            return questionsByIdCache[answer.question].category;
        });
        return cb(null, answersByCats);
        // if a question is not yet existing we will get an Error, we catch it
        // reload the cache and try again.
    } catch (err) {
        _updateQuestionsCache(function (err) {
            if (err) {
                return cb(err);
            }
            var answersByCats = _.groupBy(answers, function (answer) {
                return questionsByIdCache[answer.question].category;
            });
            return cb(null, answersByCats);

        });
    }
}

function _calculateNeedForAction(answers, cb) {
    var needForAction = [];

    _getAnswersByCats(answers, function (err, answersByCats) {
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

            var needForActionEvalFn = needForActionEvalFns[catName] || needForActionEvalFns["default"];

            var value = needForActionEvalFn(countNormalizedValues['high'],
                countNormalizedValues['mid'],
                countNormalizedValues['low']);
            needForAction.push({category: catName, value: value});
        });

        return cb(null, needForAction);
    });
}

AssessmentResultSchema.calcNeedForActionFn = _calculateNeedForAction;

module.exports = mongoose.model('AssessmentResult', AssessmentResultSchema);