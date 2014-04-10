
var error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    auth = require('../util/auth'),
    mongoose = require('mongoose'),
    _ = require('lodash'),

    AssessmentResult = mongoose.model('AssessmentResult'),
    AssessmentResultAnswer = mongoose.model('AssessmentResultAnswer');

var getNewestResult = function (baseUrl, Model) {
    return function (req, res, next) {
        Model.find({assessment: req.params.assId, owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, result) {
                if(err) {
                    return error.handleError(err, next);
                }
                if (!result || result.length === 0){
                    res.send(204);
                    return next();
                }
                res.send(result[0]);
                return next();
            });
    };
};

function assessmentResultAnswerPostFn () {
    return function (req, res, next) {

        var newAnswer = new AssessmentResultAnswer(req.body);

        // load the today's assessment result or create a new one for today

        var d = new Date(),
            month = d.getMonth(),
            year = d.getFullYear(),
            day = d.getDate();
        var today = new Date(year, month, day);

        // get latest result
        AssessmentResult
            .find({}, {}, { sort: { 'created_at' : -1 }}).exec(function (err, results) {
                if (err) {
                    return error.handleError(err, next);
                }

                var result = results.length > 0 ? results[0] : new AssessmentResult({
                    assessment: newAnswer.assessment,
                    owner: req.user.id
                });


                // delete id if older than today to save a new result
                if(result.timestamp < today) {
                    delete result.id;
                }

                var answer = _.find(result.answers, function(answer) {
                    return answer.question.equals(newAnswer.question);
                });

                if(answer) {
                    _.merge(answer, newAnswer);
                } else {
                    result.answers.push(newAnswer);
                }

                result.save(function(err, saved) {
                    if(err) {
                        return error.handleError(err, next);
                    }

                    res.send(201);
                });

            });
                // mark it dirty (for generating coach recommendations when loading the offers)
        // save
    };
}

function assessmentResultPostFn (baseUrl, Model) {
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
            if(err) {
                return error.handleError(err, next);
            }
            // TODO: pass the users current goals
            CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.userPreferences.rejectedActivities, savedObj, null, auth.isAdminForModel(req.user, mongoose.model('Activity')), function(err, recs) {
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
    assessmentResultAnswerPostFn: assessmentResultAnswerPostFn
};