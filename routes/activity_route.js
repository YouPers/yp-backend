/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    passport = require('passport'),
    genericRoutes = require('./generic'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    _ = require('lodash'),
    cachedActList;


/**
 * comments
 * @param actList
 * @param assResult
 * @param log
 * @returns {*}
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
        return next('no user found in request');
    }

    function processActivities(err, actList) {
        if (!cachedActList) {
            cachedActList = actList;
        }
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
                if (err) {
                    return next(err);
                }
                if (!assResults || assResults.length === 0) {
                    // no assessmentResults for this user, return empty recommendation array
                    req.log.trace('no AssessmentResults found for user: ' + req.username);
                    res.send([]);
                    return next();
                }
                var fokusQuestion = req.params && req.params.fokus;

                var recs = generateRecommendations(actList, assResults[0], fokusQuestion, req.log);
                if (req.user.role !== 'admin') {
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

// TODO: move to generic Auth module!
function roleBasedAuth(reqRole) {
    return function(req, res, next) {
        passport.authenticate('basic', function(err, user, info) {
            if (err) {
                return next(err);
            }

            if (!user) {
                if ('anonymous' === reqRole) {
                    return next();
                } else {
                    return next(new Error("not authorized"));
                }
            }
            // TODO: check for non anonymous Roles
            req.user = user;
            return next();
        })(req, res, next);
    };
}

module.exports = function (app, config) {

    var baseUrl = '/api/v1/activities';

    app.get({path: baseUrl, name: 'get-activities'}, roleBasedAuth('anonymous'), genericRoutes.getAllFn(baseUrl, Activity));
    app.get({path: baseUrl + '/recommendations', name: 'get-recommendations'}, passport.authenticate('basic', { session: false }), getRecommendationsFn);
    app.get(baseUrl + '/:id', roleBasedAuth('anonymous'), genericRoutes.getByIdFn(baseUrl, Activity, 'anonymous'), function(req, res, next) {cachedActList = null;});
    app.post(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.postFn(baseUrl, Activity), function(req, res, next) {cachedActList = null;});
    app.put(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.putFn(baseUrl, Activity));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Activity));



    // fake calls to support the current graphics, need to be replaced with real data soon!
    app.get("/api/v1/activitystats", function (req, res, next) {

        if (req.params.range && (req.params.range==="weekly")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "Allgemein"},
                    {"v": 9, "f": "Alle geplanten Aktivitäten durchgeführt!"},
                    {"v": 0}
                ]},
                {"c": [
                    {"v": "Fitness"},
                    {"v": 25, "f": "Vorbildiche Fitness!"},
                    {"v": 5, "f": "Möglicherweise wolltest du zuviel?"}
                ]},
                {"c": [
                    {"v": "Konsum"},
                    {"v": 12, "f": "Weiter so!"},
                    {"v": 12, "f": "Weniger ist oft mehr..."}

                ]},
                {"c": [
                    {"v": "Wohlbefinden"},
                    {"v": 2},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "Behandlungen"},
                    {"v": 2},
                    {"v": 0}

                ]}
            ]});
        } else if (req.params.range && (req.params.range==="monthly")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "Allgemein"},
                    {"v": 18, "f": "Alle geplanten Aktivitäten durchgeführt!"},
                    {"v": 0}
                ]},
                {"c": [
                    {"v": "Fitness"},
                    {"v": 50, "f": "Vorbildiche Fitness!"},
                    {"v": 5, "f": "Möglicherweise wolltest du zuviel?"}
                ]},
                {"c": [
                    {"v": "Konsum"},
                    {"v": 24, "f": "Weiter so!"},
                    {"v": 12, "f": "Weniger ist oft mehr..."}

                ]},
                {"c": [
                    {"v": "Wohlbefinden"},
                    {"v": 4},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "Behandlungen"},
                    {"v": 2},
                    {"v": 0}

                ]}
            ]});
        } else if (req.params.range && (req.params.range==="yearly")) {
            res.send({"cols": [
                {"id": "actionCluster", "label": "Aktivitätsbereich", "type": "string"},
                {"id": "done-id", "label": "durchgeführt", "type": "number"},
                {"id": "missed-id", "label": "verpasst", "type": "number"}
            ], "rows": [
                {"c": [
                    {"v": "Allgemein"},
                    {"v": 182, "f": "Alle geplanten Aktivitäten durchgeführt!"},
                    {"v": 22}
                ]},
                {"c": [
                    {"v": "Fitness"},
                    {"v": 510, "f": "Vorbildiche Fitness!"},
                    {"v": 51, "f": "Möglicherweise wolltest du zuviel?"}
                ]},
                {"c": [
                    {"v": "Konsum"},
                    {"v": 96, "f": "Weiter so!"},
                    {"v": 22, "f": "Weniger ist oft mehr..."}

                ]},
                {"c": [
                    {"v": "Wohlbefinden"},
                    {"v": 16},
                    {"v": 8}

                ]},
                {"c": [
                    {"v": "Behandlungen"},
                    {"v": 12},
                    {"v": 2}

                ]}
            ]});
        }
        return next();

    });

};