
var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    Campaign = mongoose.model('Campaign'),
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
                log.trace('no answer found for question: ' + recWeight.question);
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

        // filter out the activities this user has previously rejected
        var myActList = _.clone(actList);
        _.remove(myActList, function(act) {
            return _.any(req.user.profile.userPreferences.rejectedActivities, function(rejAct) {
                return rejAct.activity.equals(act._id);
            });
        });

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

                var recs = generateRecommendations(myActList, assResults[0], fokusQuestion, req.log);
                if (!auth.isAdminForModel(req.user, Activity)) {
                    recs = recs.slice(0,10);
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

function postActivity(req, res, next) {

    req.log.trace({parsedReq: req}, 'Post new Activity');

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
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
        return next(new error.NotAuthorizedError({ author: sentActivity.author, user: req.user.id}));
    }

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }

    if (_.contains(req.user.roles, auth.roles.productadmin)) {
        // requesting user is a product admin

        var newActivity = new Activity(sentActivity);

        // TODO: find solution for auto/incrementing activity id's
        newActivity.number = "NEW";

        // try to save the new object
        newActivity.save(function (err) {
            if (err) {
                return error.errorHandler(err, next);
            }

            res.header('location', '/api/v1/activities' + '/' + newActivity._id);
            res.send(201, newActivity);
            return next();
        });

    } else if (!_.contains(req.user.roles, auth.roles.orgadmin) && !_.contains(req.user.roles, auth.roles.campaignlead)) {
        // checks based on roles of requesting user
        return next(new error.NotAuthorizedError('POST of object only allowed if author is an org admin or a campaign lead',
            { user: req.user.id}));
    } else {
        if (!sentActivity.campaign) {
            return next(new error.MissingParameterError('expected activity to have a campaign id', { required: 'campaign id' }));
        } else {

            Campaign.findById(sentActivity.campaign).exec(function (err, campaign) {
                if (err) {
                    return error.errorHandler(err, next);
                }
                if (!campaign) {
                    return next(new error.ResourceNotFoundError('Campaign not found.', { id: sentActivity.campaign }));
                }

                // check whether the posting user is a campaignLead of the campaign
                if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                    return next(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                        userId: req.user.id,
                        campaignId: campaign.id
                    }));
                }

                var newActivity = new Activity(sentActivity);

                // TODO: find solution for auto/incrementing activity id's
                newActivity.number = "NEW_C";
                // orgadmin's and campaignlead's can only manage campaign-specific activities
                newActivity.source = "campaign";

                // try to save the new object
                newActivity.save(function (err) {
                    if (err) {
                        return error.errorHandler(err, next);
                    }

                    res.header('location', '/api/v1/activities' + '/' + newActivity._id);
                    res.send(201, newActivity);
                    return next();
                });
            });
        }

    }


}

function putActivity(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated Activity');

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
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
        return next(new error.NotAuthorizedError('POST of object only allowed if author == authenticated user', {
            userId: req.user.id,
            author: sentActivity.author
        }));
    }

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }

    Activity.findById(req.params.id).exec(function (err, reloadedActivity) {
        if(err) {
            return error.handleError(err, next);
        }
        if (!reloadedActivity) {
            return next(new error.ResourceNotFoundError({ id: sentActivity.id}));
        }

        _.extend(reloadedActivity, sentActivity);

        if (_.contains(req.user.roles, auth.roles.productadmin)) {

            // try to save the new object
            reloadedActivity.save(function (err) {
                if (err) {
                    return error.errorHandler(err, next);
                }

                res.header('location', '/api/v1/activities' + '/' + reloadedActivity._id);
                res.send(201, reloadedActivity);
                return next();
            });

        } else if (!_.contains(req.user.roles, auth.roles.orgadmin) && !_.contains(req.user.roles, auth.roles.campaignlead)) {
            // checks based on roles of requesting user
            return next(new error.NotAuthorizedError('POST of object only allowed if author is an org admin or a campaign lead', {
                userId: req.user.id
            }));
        } else {
            if (!reloadedActivity.campaign) {
                return next(new error.MissingParameterError('expected activity to have a campaign id', { required: 'campaign id' }));
            } else {

                Campaign.findById(reloadedActivity.campaign).exec(function (err, campaign) {
                    if (err) {
                        return error.errorHandler(err, next);
                    }
                    if (!campaign) {
                        return next(new error.ResourceNotFoundError('Campaign not found', { id: reloadedActivity.campaign }));
                    }

                    // check whether the posting user is a campaignLead of the campaign
                    if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                        return next(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                            userId: req.user.id,
                            campaignId: campaign.id
                        }));
                    }

                    // orgadmin's and campaignlead's can only manage campaign-specific activities
                    reloadedActivity.source = "campaign";

                    // try to save the new object
                    reloadedActivity.save(function (err) {
                        if (err) {
                            return error.errorHandler(err, next);
                        }

                        res.header('location', '/api/v1/activities' + '/' + reloadedActivity._id);
                        res.send(201, reloadedActivity);
                        return next();
                    });
                });
            }

        }

    });

}

module.exports = {
    getRecommendationsFn: getRecommendationsFn,
    invalidateActivityCache: invalidateActivityCache,
    postActivity: postActivity,
    putActivity: putActivity
};