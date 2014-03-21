var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    Campaign = mongoose.model('Campaign'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    _ = require('lodash'),
    auth = require('../util/auth'),
    error = require('../util/error'),
    async = require('async'),

    nrOfRecs = 6,

    ypHealthCoachUser = {
        avatar: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRU5FN7rcovPPzTBRbpkHx_JTCEk1Et8rnXf-aEvVexzFdYl7rjzw",
        id: "yphealthcoach",
        fullname: 'Digital Coach'
    };

/**
 * comments
 * @param actList
 * @param assResult
 * @param log
 * @param fokusQuestion
 * @param populated
 * @param callback
 * @returns {*}
 */
function _generateRecommendations(actList, assResult, fokusQuestion, log, populated, callback) {

    log.trace({assResult: assResult}, 'calculating recs for assResult');
    // calculate matchValue for each activity and store in object
    var matchValues = [], weight;
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
                    answerObj.answer / 100 * recWeight.positiveAnswerWeight :
                    Math.abs(answerObj.answer) / 100 * recWeight.negativeAnswerWeight;
                log.trace('new weight: ' + weight);
            }
        });
        activity.recWeights = undefined;
        matchValues.push({activity: populated ? activity : activity.id, weight: weight * qualityFactor});
    });

    log.trace({calculatedWeights: matchValues}, 'finished calculating weights');
    return callback(_.sortBy(matchValues, function (matchValue) {
        return -matchValue.weight;
    }));
}

var locals;

function _loadActivities(rejectedActivities, done) {
    Activity
        .find()
        .select('+recWeights +qualityFactor -text -description')
        .exec(function (err, activities) {
            if (err) {
                return error.handleError(err, done);
            }

            if (rejectedActivities && rejectedActivities.length > 0) {
                _.remove(activities, function (act) {
                    return _.any(rejectedActivities, function (rejAct) {
                        return rejAct.activity.equals(act._id);
                    });
                });
            }
            locals.activities = activities;
            return done();
        });
}

function _loadAssessmentResult(user, done) {
    AssessmentResult.find({owner: user.id})
        .sort({timestamp: -1})
        .limit(1)
        .exec(function (err, assResults) {
            if (err) {
                return error.handleError(err, done);
            }
            if (assResults && assResults.length > 0) {
                locals.assResult = assResults[0];
            }

            return done();

        });
}

function getRecommendationsFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    var fokusQuestion = req.params && req.params.fokus;
    var rejectedActs = req.user.profile.userPreferences.rejectedActivities || [];

    async.parallel([
        _loadActivities.bind(null, rejectedActs),
        _loadAssessmentResult.bind(null, req.user)
    ], function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        if (!locals.assResult) {
            // this users has no assessmentResults so we have no recommendations
            res.send([]);
            return next();
        }

        _generateRecommendations(locals.activities, locals.assResult, fokusQuestion, req.log, req.params.populate === 'activity', function (recs) {
            if (!auth.isAdminForModel(req.user, Activity)) {
                recs = recs.slice(0, 10);
            }
            res.send(recs);
            return next();
        });
    });
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

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }

    Activity.findById(req.params.id).exec(function (err, reloadedActivity) {
        if (err) {
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

                res.send(200, reloadedActivity);
                return next();
            });

        } else if (!_.contains(req.user.roles, auth.roles.orgadmin) && !_.contains(req.user.roles, auth.roles.campaignlead)) {
            // checks based on roles of requesting user
            return next(new error.NotAuthorizedError('PUT of object only allowed if author is an org admin or a campaign lead', {
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


/**
 * The list of suggested offers consists of:
 * 1. top offers form the coachRecommendations of the recommendation logic "assessmentResult-activity"
 * 2. currently active campaign activities
 * 3. currently active campaign activity Plans
 * 4. currently pending personal invitations
 * 5. currently available accessible group activities the user may join.
 *
 * We return an array of offers, where one offer is an object:
 * {
 *      activity: populated link to the activity (always available)
 *      activityPlan: [] of populated links to the suggested activityPlans (available in case 3./4./5.)
 *                    may be an array in case this activity has multiple invitations, recommendedPlans
 *      type: [] of one of ('ypHealthCoach', 'campaignActivity', 'campaignPlan', 'personalInvitation', 'publicPlan')
 *            may be an array if this activity was recommended by more than one source
 *      recommendedBy: []   link to the user  who recommended this, in case:
 *          1. a virtual user for our digital health coach
 *          2. a virtual user for the campaign avatar
 *          3. the campaign lead who added the plan
 *          4. the peer who sent the invite
 *          5. the peer who planned the available group activity
 *          may be an array if the same activity has been recommended by multiple sources.
 *       prio: prioritization Value, in case of recs this is the recWeight
 * }
 * @param req
 * @param res
 * @param next
 * @returns [{*}]
 */
function getActivityOffersFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    locals = {};

    async.parallel([
        function coachRecommendations(done) {
            var myResponse = {send: function (obj) {
                this.recs = obj;
            }};
            req.params.populate = 'activity';
            getRecommendationsFn(req, myResponse, function (err) {
                if (err) {
                    return error.handleError(done);
                }
                locals.coachRecs = [];
                _.forEach(myResponse.recs, function (rec) {
                    var myRec = {
                        activity: rec.activity,
                        activityPlan: [],
                        type: ['ypHealthCoach'],
                        recommendedBy: [ypHealthCoachUser],
                        prio: [rec.weight]
                    };
                    locals.coachRecs.push(myRec);
                });
                return done();
            });
        },
        function campaignActs(done) {
            locals.campaignActs = [];
            if (!req.user.campaign) {
                return done();
            }

            Activity
                .find({campaign: req.user.campaign})
                .sort({modified: -1})
                .populate('author campaign')
                .exec(function (err, campActs) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    _.forEach(campActs, function (campAct) {
                        var myCampAct = {
                            activity: campAct,
                            activityPlan: [],
                            type: ['campaignActivity'],
                            recommendedBy: [
                                {
                                    fullname: campAct.campaign.title
                                }
                            ],
                            prio: [400]
                        };
                        locals.campaignActs.push(myCampAct);
                    });
                    return done();
                });
        },
        function campaignActPlans(done) {
            locals.campaignActPlans = [];
            if (!req.user.campaign) {
                return done();
            }
            ActivityPlan
                .find({
                    campaign: req.user.campaign,
                    visibility: {$in: ['public', 'campaign']},
                    status: 'active',
                    executionType: 'group',
                    masterPlan: null,
                    source: 'campaign'})
                .sort({modified: -1})
                .populate('activity owner')
                .exec(function (err, campPlans) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    _.forEach(campPlans, function (campPlan) {
                        var myCampPlan = {
                            activity: campPlan.activity,
                            activityPlan: [campPlan],
                            type: ['campaignActivityPlan'],
                            recommendedBy: [campPlan.owner],
                            prio: [500]
                        };
                        locals.campaignActPlans.push(myCampPlan);
                    });
                    return done();
                });
        },
        function personalPlans(done) {
            ActivityPlan
                .find({
                    owner: req.user._id,
                    status: {$in: ['active', 'invite']}
                })
                .populate('activity owner')
                .exec(function (err, invites) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    locals.personalPlans = invites;
                    return done();
                });
        },
        function publicGroupPlans(done) {
            // TODO: Decide whether to allow real public plans, over multiple campaigns/organizations!!!
            ActivityPlan
                .find({
                    visibility: {$in: [ 'campaign']},
                    campaign: req.user.campaign,
                    source: 'community',
                    status: 'active',
                    executionType: 'group',
                    masterPlan: null})
//                .sort({modified: -1})
                .populate('activity owner')
                .exec(function (err, publicPlans) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    locals.publicGroupPlans = [];
                    _.forEach(publicPlans, function (publicPlan) {
                        var myPublicPlan = {
                            activity: publicPlan.activity,
                            activityPlan: [publicPlan],
                            recommendedBy: [publicPlan.owner],
                            type: ['publicPlan'],
                            prio: [1]
                        };
                        locals.publicGroupPlans.push(myPublicPlan);
                    });
                    return done();
                });
        }
    ], function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        // go through all personalPlans and sort them into the results.
        // - if it is in status 'invite', create an offer for this activity that is recommended with type personalInvite
        // - if it is in status 'active'
        //     - if it is in the list of coachRecommended or campaignRecommended --> remove the matching recommendations
        //               reason: this activity is already planned
        //     - if the same activity is in a plan of the campaignRecommendedPlans --> remove the campaignRecommendedPlan
        //     - if its act is in the list of publicGroupActvities --> remove the matching publicGroupActivities from the recommendations
        //               reason: this activity is already planned.
        locals.personalInvites = [];
        _.forEach(locals.personalPlans, function (plan) {
            if (plan.status === 'invite') {
                var myPersonalInvite = {
                    activity: plan.activity,
                    activityPlan: [plan],
                    recommendedBy: [plan.invitedBy],
                    type: ['personalInvitation'],
                    prio: [1000]
                };
                locals.personalInvites.push(myPersonalInvite);
            } else if (plan.status === 'active') {

                // remove this activity from coachRecs because we have an active plan
                _.remove(locals.coachRecs, function (rec) {
                    return plan.activity._id === rec.activity._id;
                });

                // remove this activity from campaignRecs because we have an active plan
                _.remove(locals.campaignActs, function (rec) {
                    return plan.activity._id === rec.activity._id;
                });

                // remove activityPlan from campaignRecPlan because we have an active Plan
                _.remove(locals.campaignActPlans, function (rec) {
                    return plan.activity._id === rec.activity._id;
                });

                // TODO: is it possible to have an invite for an activity that is already planned????

                // remove from publicActivityPlan if we already have an active Plan
                _.remove(locals.publicPlans, function (rec) {
                    return plan.activity._id === rec.activity._id;
                });

            } else {
                return next(new error.InternalError('this should never happen', {plan: plan}));
            }

        });

        // consolidate:
        //      we want one consolidated list out of the 5 possible sources so we need to join the five arrays
        var myRecs = locals.coachRecs
            .concat(locals.campaignActs)
            .concat(locals.campaignActPlans)
            .concat(locals.personalInvites)
            .concat(locals.publicGroupPlans);

        // removeRejected:
        //      the user may have rejected Activities in his profile (when he clicked "not for me" earlier). We need
        //      to remove them from the recommendations.
        var rejActs = req.user.profile.userPreferences.rejectedActivities;
        if (rejActs.length > 0) {
            _.remove(myRecs, function (rec) {
                return _.any(rejActs, function (rejAct) {
                    return rejAct.equals(rec.activity._id);
                });
            });
        }

        // remove dups:
        //      if we now have more than one recommendation for the same activity from the different sources
        //      we need to consolidate them into one recommendation with multiple recommenders, sources and possibly plans.
        //      We do this by merging the recommender, the type and the plan property into an array.

        // sort them into a object keyed by activity._id to remove dups
        var myRecsHash = {};
        _.forEach(myRecs, function (rec) {
            if (myRecsHash[rec.activity._id]) {
                // this act already exists, so we merge
                var existingRec = myRecsHash[rec.activity._id];
                if (rec.activityPlan) {
                    existingRec.activityPlan.push(rec.activityPlan);
                }
                existingRec.recommendedBy.push(rec.recommendedBy[0]);
                existingRec.type.push(rec.type[0]);
                existingRec.prio.push(rec.prio[0]);
            } else {
                // this act does not yet exist, so we add
                myRecsHash[rec.activity._id] = rec;
            }
        });

        // sort and limit:
        //      we want to display the best/most important recommendation first
        //      we only want to deliver a limited number of recommendations
        res.send(_.sortBy(myRecsHash, function (rec) {
            return -1 * _.max(rec.prio);
        }).slice(0, nrOfRecs));
        return next();
    });
}

module.exports = {
    getRecommendationsFn: getRecommendationsFn,
    postActivity: postActivity,
    putActivity: putActivity,
    getActivityOffersFn: getActivityOffersFn
};