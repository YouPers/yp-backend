var error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    auth = require('../util/auth'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    AssessmentQuestion = mongoose.model('AssessmentQuestion'),
    AssessmentResultAnswer = mongoose.model('AssessmentResultAnswer'),
    generic = require('./generic');

var getNewestResult = function (baseUrl) {
    return function (req, res, next) {

        var dbQuery = AssessmentResult.find({assessment: req.params.assessmentId, owner: req.user.id});

        generic.addStandardQueryOptions(req, dbQuery, AssessmentResult);

        dbQuery
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, results) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (!results || results.length === 0) {
                    res.send(204);
                    return next();
                }
                var newestResult = results[0];
                if (req.params.populatedeep && req.params.populatedeep === 'answers.question') {
                    AssessmentQuestion.populate(newestResult.answers, 'question', function (err, answers) {
                        if (err) {
                            return error.handleError(err, next);
                        }
                        res.send(newestResult);
                        return next();
                    });
                } else {
                    res.send(newestResult);
                    return next();
                }

            });
    };
};

function assessmentResultAnswerPutFn() {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, AssessmentResultAnswer);

        if (err) {
            return error.handleError(err, next);
        }

        var newAnswer = new AssessmentResultAnswer(req.body);

        // load the today's assessment result or create a new one for today

        var d = new Date(),
            month = d.getMonth(),
            year = d.getFullYear(),
            day = d.getDate();
        var today = new Date(year, month, day);

        // get latest result
        AssessmentResult
            .find({owner: req.user.id, assessment: newAnswer.assessment}, {}, { sort: { 'created': -1 }}).exec(function (err, results) {
                if (err) {
                    return error.handleError(err, next);
                }

                var result = results.length > 0 ? results[0] : new AssessmentResult({
                    assessment: newAnswer.assessment,
                    owner: req.user.id,
                    answers: [],
                    timestamp: new Date()
                });


                // delete id if older than today to save a new result
                if (result.timestamp < today) {
                    delete result.id;
                }

                var answerIndex = _.findIndex(result.answers, function (answer) {
                    return answer.question.equals(newAnswer.question);
                });

                if (answerIndex >= 0) {
                    result.answers.splice(answerIndex, 1);
                }
                result.answers.push(newAnswer);
                result.dirty = true;

                result.save(function (err, saved) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    res.send(200);
                    return next();
                });

            });

    };
}

function assessmentResultPostFn(baseUrl, Model) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, Model);

        if (err) {
            return error.handleError(err, next);
        }

        // if this Model has a campaign Attribute and the user is currently part of a campaign,
        // we set the campaign on this object --> by default new objects are part of a campaign
        if (req.user && req.user.campaign && Model.schema.paths['campaign']) {
            req.body.campaign = req.user.campaign.id || req.user.campaign; // handle populated and unpopulated case
        }

        var newObj = new Model(req.body);

        req.log.trace(newObj, 'PostFn: Saving new Object');
        // try to save the new object
        newObj.save(function (err, savedObj) {
            if (err) {
                return error.handleError(err, next);
            }

            CoachRecommendation.generateAndStoreRecommendations(
                req.user._id,
                req.user.profile.userPreferences.rejectedActivities,
                savedObj,
                req.user.profile.userPreferences.focus,
                auth.isAdminForModel(req.user, mongoose.model('Activity')),
                function (err, recs) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    res.header('location', req.url + '/' + savedObj._id);
                    res.send(201, savedObj);
                    return next();
                });
        });
    };
}


module.exports = {
    getNewestResult: getNewestResult,
    assessmentResultPostFn: assessmentResultPostFn,
    assessmentResultAnswerPutFn: assessmentResultAnswerPutFn
};