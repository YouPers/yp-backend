
var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    Campaign = mongoose.model('Campaign'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    Rest = require('restify'),
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

function processSaveActivity (req, res, next, saveType) {

    req.log.trace({parsedReq: req}, saveType + ' Activity');

    if (!req.body) {
        return next(new Rest.InvalidContentError('expected JSON body in ' + saveType + 'for activity'));
    }

    var sentActivity = req.body;

    req.log.trace({body: sentActivity}, 'parsed req body');

    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference only
    // do this check only for properties of type ObjectID
    _.filter(Activity.schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in sentActivity) && (!(typeof sentActivity[myPath.path] === 'string' || sentActivity[myPath.path] instanceof String))) {
                sentActivity[myPath.path] = sentActivity[myPath.path].id;
            }
        });

    // check whether delivered author is the authenticated user
    if (sentActivity.author && (req.user.id !== sentActivity.author)) {
        return next(new Rest.NotAuthorizedError('POST of object only allowed if author == authenticated user'));
    }

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }


    if (_.contains(req.user.roles, auth.roles.productadmin)) {
        // requesting user is a product admin

        var newActivity = new Activity(sentActivity);

        newActivity.number = "NEW";
        newActivity.source = "youpers";

        // try to save the new object
        newActivity.save(function (err) {
            if (err) {
                req.log.error({Error: err}, 'Error Saving Activity');
                err.statusCode = 409;
                return next(err);
            }

            res.header('location', '/api/v1/activities' + '/' + newActivity._id);
            res.send(201, newActivity);
            return next();
        });

    } else if (!_.contains(req.user.roles, auth.roles.orgadmin) && !_.contains(req.user.roles, auth.roles.campaignlead)) {
        // checks based on roles of requesting user
        return next(new Rest.NotAuthorizedError('POST of object only allowed if author is an org admin or a campaign lead'));
    } else {
        if (!sentActivity.campaign) {
            return next(new Rest.InvalidContentError('expected activity to have a campaign id'));
        } else {

            Campaign.findById(sentActivity.campaign).exec(function (err, campaign) {
                if (err) {
                    return next(err);
                }
                if (!campaign) {
                    return next(new Rest.ResourceNotFoundError('Campaign with id: ' + sentActivity.campaign + ' not found.'));
                }

                // check whether the posting user is a campaignLead of the campaign
                if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                    return next(new Rest.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                        userId: req.user.id,
                        campaignId: campaign.id
                    }));
                }

                var newActivity = new Activity(sentActivity);

                newActivity.number = "NEW_C";
                newActivity.source = "campaign";

                // try to save the new object
                newActivity.save(function (err) {
                    if (err) {
                        req.log.error({Error: err}, 'Error Saving Activity');
                        err.statusCode = 409;
                        return next(err);
                    }

                    res.header('location', '/api/v1/activities' + '/' + newActivity._id);
                    res.send(201, newActivity);
                    return next();
                });
            });
        }

    }

}

function postActivity(req, res, next) {

    processSaveActivity(req, res, next, "Post");

}

function putActivity(req, res, next) {

    processSaveActivity(req, res, next, "Put");

}

module.exports = {
    getRecommendationsFn: getRecommendationsFn,
    invalidateActivityCache: invalidateActivityCache,
    postActivity: postActivity,
    putActivity: putActivity
};