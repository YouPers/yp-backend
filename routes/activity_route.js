/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    passport = require('passport'),
    genericRoutes = require('./generic'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    _ = require('lodash');

function generateRecommendations(actList, assResult, log) {

    // calculate recWeight for each activity and store in object
    var recWeights = [];
    _.forEach(actList, function (activity) {
        var weight;
        _.forEach(activity.recWeigths, function(recWeight) {
             var answerObj = _.find(assResult.answers, function(ans) {
                return ans.question === recWeight.question;
             });

            if(!answerObj) {
                log.info('no answer found for question: ' + recWeight.question);
            }
            weight +=  (answerObj.answer >= 0) ?
                answerObj.answer /100 * recWeight.positiveAnswerWeight /100:
                Math.abs(answerObj.answer) /100 * recWeight.negativeAnswerWeight /100;
        });
        recWeights.push({activity: activity.id, weight: weight});
    });

    return _.pluck(_.sortBy(recWeights,'weight').slice(-5),'activity');
}

function getRecommendationsFn(req, res, next) {
    if (!req.user) {
        return next('no user found in request');
    }

    Activity.find().exec(function(err, actList) {
        if (err) {
            return next(err);
        }
        if (!actList || actList.length === 0) {
            return next('no activities found');
        }
        AssessmentResult.find({owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, assResults) {
           if (err) {return next(err);}
            if (!assResults || assResults.length === 0) {
                // no assessmentResults for this user, return empty recommendation array
                req.log.trace('no AssessmentResults found for user: ' + req.username);
                res.send([]);
                return next();
            }

            res.send(generateRecommendations(actList, assResults[0], req.log));
            return next();
        });
    });

}


module.exports = function (app, config) {

    var baseUrl = '/api/v1/activities';

    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, Activity));
    app.get(baseUrl+'/recommendations', passport.authenticate('basic', { session: false }),getRecommendationsFn);
    app.get(baseUrl+'/:id', genericRoutes.getByIdFn(baseUrl, Activity));
    app.post(baseUrl, passport.authenticate('basic', { session: false }),genericRoutes.postFn(baseUrl, Activity));
    app.put(baseUrl+'/:id', passport.authenticate('basic', { session: false }), genericRoutes.putFn(baseUrl, Activity));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Activity));

};