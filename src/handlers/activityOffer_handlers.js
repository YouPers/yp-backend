var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Activity = mongoose.model('Activity'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    ActivityOffer = mongoose.model('ActivityOffer'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    actMgr = require('../core/ActivityManagement'),
    _ = require('lodash'),
    async = require('async'),
    error = require('../util/error'),
    utils = require('./handlerUtils'),
    auth = require('../util/auth'),
    generic = require('./generic'),
    moment = require('moment');


/**
 * allows to post an Offer/Recommendation for an unplanned activity
 * @param req
 * @param res
 * @param next
 */
function postActivityOffer(req, res, next) {

    var err = utils.checkWritingPreCond(req.body, req.user, ActivityOffer);
    if (err) {
        return error.handleError(err, next);
    }

    var offer = new ActivityOffer(req.body);

    offer.save(function (err, savedOffer) {
        if (err) {
            return error.handleError(err, next);
        }
        actMgr.emit('activity:offerSaved', savedOffer);
        return generic.writeObjCb(req, res, next)(err, savedOffer);
    });

}

/**
 * allows to post an Offer/Recommendation for an unplanned activity
 * @param req
 * @param res
 * @param next
 */
function putActivityOffer(req, res, next) {

    var err = utils.checkWritingPreCond(req.body, req.user, ActivityOffer);
    if (err) {
        return error.handleError(err, next);
    }
    var sentObj = req.body;

    var q = ActivityOffer.findById(req.params.id);

    // if this Model has privateProperties, include them in the select, so we get the whole object
    // because we need to save it later!
    if (ActivityOffer.privatePropertiesSelector) {
        q.select(ActivityOffer.privatePropertiesSelector);
    }
    if (ActivityOffer.adminAttrsSelector) {
        q.select(ActivityOffer.adminAttrsSelector);
    }

    q.exec(function (err, objFromDb) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!objFromDb) {
            return next(new error.ResourceNotFoundError('no object found with the specified id', {
                id: req.params.id
            }));
        }

        _.extend(objFromDb, sentObj);

        return objFromDb.save(function (err, savedOffer) {
            actMgr.emit('activity:offerUpdated', savedOffer);
            return generic.writeObjCb(req, res, next)(null, savedOffer);
        });
    });
}


function getCoachRecommendationsFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    var admin = auth.isAdminForModel(req.user, mongoose.model('Activity'));

    CoachRecommendation.generateAndStoreRecommendations(req.user._id,
        req.user.profile.userPreferences.rejectedActivities, null, req.user.profile.userPreferences.focus, admin, function (err, recs) {

            if (err) {
                error.handleError(err, next);
            }
            res.send(_.sortBy(recs, function (rec) {
                return -rec.score;
            }) || []);
            return next();
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
 *      offerType: [] of one of ('ypHealthCoach', 'campaignActivity', 'campaignPlan', 'personalInvitation', 'publicPlan')
 *            may be an array if this activity was recommended by more than one source
 *      recommendedBy: []   link to the user  who recommended this, in case:
 *          1. a virtual user for our digital health coach
 *          2. a virtual user for the campaign avatar
 *          3. the campaign lead who added the plan
 *          4. the peer who sent the invite
 *          5. the peer who planned the available group activity
 *          may be an array if the same activity has been recommended by multiple sources.
 *       prio: prioritization Value, in case of CoachRecs this is the score of the algorithm
 * }
 *
 * The array of offers is then sorted into 3 groups,
 *
 * - with a preferred offerType of:
 *
 * -- campaignActivityPlan
 * -- ypHealthCoach
 * -- personalInvitation
 *
 * - and in case no more offers with this offerType are available,
 *   the next highest rated offer offerType according to:
 *
 * 'publicActivityPlan', // lowest prio
 * 'personalInvitation',
 * 'ypHealthCoach',
 * 'campaignActivity',
 * 'campaignActivityPlan' // highest prio
 *
 *
 [

 group 1 - left:
 1. campaign plan
 2. campaign act
 3. coach
 4. personal
 5. public

 group 2 - middle:
 1. coach
 2. campaign plan
 3. campaign act
 4. personal
 5. public

 group 3 - right:
 1. personal
 2. campaign plan
 3. campaign act
 4. coach
 5. public

 ] repeats 3x

 *
 *
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function getActivityOffersFn(req, res, next) {

    if (req.params.campaign && auth.checkAccess(req.user, 'al_campaignlead')) {
        // this is a campaignleads request for administration of offers in a campaign
        return _getCampaignActivityOffers(req, res, next);
    }

    var activityFilter = req.params.activity;

    var locals = {};


    // load currently active plans for this user, because we do not want to display offers that he has
    // already planned
    var getActivityPlans = function getActivityPlans(done) {

        ActivityPlan
            .find({$or: [{
                owner: req.user._id,
                status: 'active'}, {
                joiningUsers: req.user._id,
                status: 'active'}]})
            .select('activity')
            .exec(function (err, plans) {
                if (err) {
                    return done(err);
                }
                locals.plans = plans;
                return done();
            });

    };


    var getAssessmentResult = function getAssessmentResult(done) {

        AssessmentResult
            .find({owner: req.user.id}, {}, { sort: { 'created': -1 }, limit: 1, select: 'dirty'}).exec(function (err, results) {
                if (err) {
                    return done(err);
                }

                locals.result = results.length > 0 ? results[0] : undefined;
                return done();
            });

    };

    var collectionTasks = req.user ? [ getActivityPlans, getAssessmentResult] : [];

    async.parallel(collectionTasks, function (err) {

        if (err) {
            return error.handleError(err, next);
        }

        // check if activity has already been planned
        if (activityFilter) {
            var plan = _.find(locals.plans, function (plan) {
                return plan.activity.equals(activityFilter);
            });
            if (plan) {
                return next(new error.ConflictError('The user has already planned this activity', {
                    activityId: activityFilter,
                    activityPlanId: plan.id,
                    reason: 'alreadyPlanned'
                }));
            }
        }


        // check if result is dirty (new answers have been put),
        // then generate and/or load offers, before consolidating them
        if (locals.result && locals.result.dirty) {
            var admin = auth.isAdminForModel(req.user, mongoose.model('Activity'));
            CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.userPreferences.rejectedActivities,
                null, req.user.profile.userPreferences.focus, admin, loadOffers);
        } else {
            loadOffers();
        }

        function loadOffers(err) {

            if (err) {
                return error.handleError(err, next);
            }

            var targetQueues = [req.user._id];
            if (req.user.campaign) {
                targetQueues.push(req.user.campaign._id);
            }

            var selector = {targetQueue: {$in: targetQueues}};

            // check whether the client only wanted offers for one specific activity
            if (activityFilter) {
                selector.activity = req.params.activity;
            }
            var dateToUse = moment().toDate();
            ActivityOffer
                .find(selector)
                .and({$or: [
                    {validTo: {$exists: false}},
                    {validTo: {$gte: dateToUse}}
                ]})
                .and({$or: [
                    {validFrom: {$exists: false}},
                    {validFrom: {$lte: dateToUse}}
                ]})
                .populate('activity activityPlan recommendedBy')
                .exec(function (err, offers) {
                    User.populate(offers, { path: 'activityPlan.owner activityPlan.joiningUsers' }, function (err, offers) {

                        consolidate(err, offers);

                    });

                });
        }

        function consolidate(err, offers) {

            var actsToRemove = [];

            if (req.user) {
                var plannedActs = _.map(locals.plans, 'activity');
                var rejActs = _.map(req.user.profile.userPreferences.rejectedActivities, 'activity');
                actsToRemove = plannedActs.concat(rejActs);
            }

            // only remove if the user did not request offers for one specific activity
            if (!activityFilter) {
                _.remove(offers, function (offer) {
                    return _.any(actsToRemove, function (actToRemoveId) {
                        return actToRemoveId.equals(offer.activity._id);
                    });
                });
            }

            // consolidate dups:
            //      if we now have more than one recommendation for the same activity from the different sources
            //      we need to consolidate them into one recommendation with multiple recommenders, sources and possibly plans.
            //      We do this by merging the recommender, the offerType and the plan property into an array.

            // prio them into a object keyed by activity._id to remove dups
            var myOffersHash = {};
            _.forEach(offers, function (offer) {
                if (myOffersHash[offer.activity._id]) {
                    // this act already exists, so we merge
                    var existingRec = myOffersHash[offer.activity._id];
                    _.forEach(offer.activityPlan, function (activityPlan) {
                        if (!_.contains(_.pluck(existingRec.activityPlan, 'id'), activityPlan.id)) {
                            existingRec.activityPlan.push(activityPlan);
                        }
                    });
                    _.forEach(offer.recommendedBy, function (recommendedBy) {
                        if (!_.contains(_.pluck(existingRec.recommendedBy, 'id'), recommendedBy.id)) {
                            existingRec.recommendedBy.push(recommendedBy);
                        }
                    });
                    existingRec.offerType = _.union(existingRec.offerType, offer.offerType);
                    existingRec.prio = _.union(existingRec.prio, offer.prio);
                } else {
                    // this act does not yet exist, so we add
                    myOffersHash[offer.activity._id] = offer;
                }
            });

            // sort offers

            var typesLowestToHighestPriority = [
                'publicActivityPlan',
                'personalInvitation',
                'ypHealthCoach',
                'campaignActivity',
                'campaignActivityPlan'
            ];

            var priority = function priority(preferredType) {

                return function (offer) {

                    for (var priority = typesLowestToHighestPriority.length; priority > 0; priority--) {

                        if (_.contains(offer.offerType, preferredType)) {
                            return -6;
                        } else if (_.contains(offer.offerType, typesLowestToHighestPriority[priority])) {
                            return -priority;
                        }
                    }
                };
            };

            var addOfferByType = function addOfferByType(preferredType) {

                var sortedByType = _.sortBy(myOffersHash, priority(preferredType));

                if (sortedByType.length > 0) {

                    var offer = sortedByType[0];

                    // limit to 8 per type
                    var maxPerType = 8;

                    var countPerType = _.filter(sortedOffers, function (o) {
                        return _.any(o.offerType, function (offerType) {
                            return _.contains(offer.offerType, offerType);
                        });
                    }).length;

                    if (countPerType < maxPerType) {
                        sortedOffers.push(offer);
                        delete myOffersHash[offer.activity._id];
                    }

                }
            };

            var sortedOffers = [];

            for (var k = 0; k < 3; k++) {
                addOfferByType('campaignActivityPlan');
                addOfferByType('ypHealthCoach');
                addOfferByType('personalInvitation');
            }

            // add all personalInvitations that were not added before

            sortedOffers = sortedOffers.concat(_.filter(myOffersHash, function (offer) {
                return _.contains(offer.offerType, 'personalInvitation');
            }));

            // fill up to 9 with publicActivityPlans
            if (sortedOffers.length < 9) {
                var publicPlans = _.filter(myOffersHash, function (offer) {
                    return _.contains(offer.offerType, 'publicActivityPlan');
                });
                sortedOffers = sortedOffers.concat(publicPlans.slice(0, 9 - sortedOffers.length));
            }

            if ((activityFilter && sortedOffers.length === 0) || (!activityFilter && sortedOffers.length < 3)) {
                _getDefaultActivityOffers(activityFilter, function (err, defaultOffers) {
                    if (err) {
                        return error.handleError(err, next);
                    }

                    sortedOffers = sortedOffers.concat(defaultOffers);

                    // only remove if the user did not request offers for one specific activity
                    if (!activityFilter) {
                        _.remove(sortedOffers, function (offer) {
                            return _.any(actsToRemove, function (actToRemoveId) {
                                return offer.activity._id.equals(actToRemoveId);
                            });
                        });
                    }

                    res.send(sortedOffers);
                    return next();
                });
            } else {
                res.send(sortedOffers);
                return next();
            }
        }
    });

}

function _getCampaignActivityOffers(req, res, next) {

    var query = ActivityOffer.find({targetQueue: req.params.campaign, offerType: {$ne: 'publicActivityPlan'}});
    generic.addStandardQueryOptions(req, query, ActivityOffer);

    query.exec(function (err, offers) {

        // for offers of offerType recommendation add the count of how many users have planned this activity as part
        // of the campaign
        async.forEach(_.filter(offers, function (offer) {
                return offer.offerType[0] === 'campaignActivity';
            }),
            function (offer, done) {
                ActivityPlan.count(
                    {activity: offer.activity._id || offer.activity,
                        campaign: offer.targetQueue._id || offer.targetQueue
                    }).exec(function (err, count) {
                        if (err) {
                            return done(err);
                        }
                        req.log.info({count: count}, 'plan Count');
                        offer.planCount = count;
                        return done();
                    });
            },
            function (err) {
                if (err) {
                    return error.handleError(err, next);
                }
                return generic.sendListCb(req, res, next)(err, offers);
            }
        );


    });
}

var deleteActivityOffers = function (req, res, next) {
    // instead of using Model.remove directly, findOne in combination with obj.remove
    // is used in order to trigger
    // - schema.pre('remove', ... or
    // - schema.pre('remove', ...
    // see user_model.js for an example


    // check if this is a "personal" object (i.e. has an "owner" property),
    // if yes only delete the objects of the currently logged in user
    var finder = {};
    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    } else if (!auth.checkAccess(req.user, 'al_systemadmin')) {
        finder = {targetQueue: req.user.id};
    } else {
        // user is systemadmin, he may delete all
    }
    var dbQuery = ActivityOffer.find(finder);

    dbQuery.exec(function (err, objects) {
        if (err) {
            return error.handleError(err, next);
        }
        _.forEach(objects, function (obj) {
            obj.remove(function (err) {
                if (err) {
                    req.log.error(err);
                }
                actMgr.emit('activity:offerDeleted', obj);
            });
        });
        res.send(200);
    });
};


function deleteActivityOfferByIdFn(req, res, next) {
    var finder = {_id: req.params.id};

    ActivityOffer.findOne(finder).exec(function (err, obj) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!obj) {
            return next(new error.ResourceNotFoundError());
        }
        obj.remove(function (err) {
            if (err) {
                error.handleError(err, next);
            }
            actMgr.emit('activity:offerDeleted', obj);
            res.send(200);
        });

    });
}

function _getDefaultActivityOffers(activityFilter, cb) {
    var selector = {};
    if (activityFilter) {
        selector._id = activityFilter;
    }
    Activity
        .find(selector, {}, { sort: { 'qualityFactor': -1 }, limit: 8 })
        .exec(function (err, activities) {

            if (err) {
                cb(err);
            }

            User.findById(CoachRecommendation.healthCoachUserId, function (err, healthCoachUser) {
                if (err) {
                    cb(err);
                }
                var offers = [];
                _.forEach(activities, function (activity) {

                    var offer = {
                        activity: activity,
                        activityPlan: [],
                        recommendedBy: [healthCoachUser],
                        offerType: ['defaultActivity'],
                        sourceType: 'youpers',
                        prio: activity.qualityFactor
                    };

                    offers.push(offer);
                });

                return cb(null, offers);
            });
        });
}

module.exports = {
    getCoachRecommendationsFn: getCoachRecommendationsFn,
    getActivityOffersFn: getActivityOffersFn,
    postActivityOfferFn: postActivityOffer,
    deleteActivityOffersFn: deleteActivityOffers,
    deleteActivityOfferByIdFn: deleteActivityOfferByIdFn,
    putActivityOfferFn: putActivityOffer
};
