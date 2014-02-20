
var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    _ = require('lodash'),
    auth = require('../util/auth'),
    error = require('../util/error'),
    cachedActList;


/**
 * comments
 * @param actList
 * @param assResult
 * @param log
 * @returns {*}
 * @param fokusQuestion
 */
function generateRecommendations(actList, assResult, fokusQuestion, log) {

    log.trace({assResult: assResult}, 'calculating recs for assResult');
    // calculate recWeight for each activity and store in object
    var recWeights = [], weight;
    _.forEach(actList, function (activity) {
        var qualityFactor = activity.qualityFactor || 1;
        weight = 1;
        _.forEach(activity.recWeights, function (recWeight) {
            var answerObj = _.find(assResult.answers, function (ans) {
                return ans.question.equals(recWeight.question);
            });

            if (!answerObj || (fokusQuestion && (answerObj.question.toString() !== fokusQuestion))) {
                log.info('no answer found for question: ' + recWeight.question);
            } else {
                weight += (answerObj.answer >= 0) ?
                    answerObj.answer /100* recWeight.positiveAnswerWeight :
                    Math.abs(answerObj.answer)/100 * recWeight.negativeAnswerWeight;
                log.trace('new weight: '+ weight);
            }
        });
        recWeights.push({activity: activity.id, weight: weight*qualityFactor});
    });

    log.trace({calculatedWeights: recWeights}, 'finished calculating weights');
    return _.sortBy(recWeights, function(recWeight) {
        return -recWeight.weight;
    });
}

function getRecommendationsFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    function processActivities(err, actList) {
        if(err) {
            return error.handleError(err, next);
        }
        if (!cachedActList) {
            cachedActList = actList;
        }

        if (!actList || actList.length === 0) {
            return next(new error.ResourceNotFoundError('No activities found.'));
        }
        AssessmentResult.find({owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, assResults) {
                if(err) {
                    return error.handleError(err, next);
                }
                if (!assResults || assResults.length === 0) {
                    // no assessmentResults for this user, return empty recommendation array
                    req.log.trace('no AssessmentResults found for user: ' + req.username);
                    res.send([]);
                    return next();
                }
                var fokusQuestion = req.params && req.params.fokus;

                var recs = generateRecommendations(actList, assResults[0], fokusQuestion, req.log);
                if (!auth.isAdminForModel(req.user, Activity)) {
                    recs = recs.slice(0,5);
                }
                res.send(recs);
                return next();
            });
    }

    if (cachedActList) {
        processActivities(null, cachedActList);
    } else {
        Activity.find().select('+recWeights +qualityFactor').exec(processActivities);
    }
}

function invalidateActivityCache(req, res, next) {
    cachedActList = null;
    return next();
}

module.exports = {
    getRecommendationsFn: getRecommendationsFn,
    invalidateActivityCache: invalidateActivityCache
};