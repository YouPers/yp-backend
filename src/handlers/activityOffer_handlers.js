var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Idea = mongoose.model('Idea'),
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

    var admin = auth.isAdminForModel(req.user, mongoose.model('Idea'));

    CoachRecommendation.generateAndStoreRecommendations(req.user._id,
        req.user.profile.prefs.rejectedIdeas, null, req.user.profile.prefs.focus, admin, function (err, recs) {

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
 * 3. currently active campaign activityPlans
 * 4. currently pending personal invitations
 * 5. currently available accessible group activities the user may join.
 *
 * We return an array of offers, where one offer is an object:
 * {
 *      idea: populated link to the idea (always available)
 *      activityPlan: [] of populated links to the suggested activityPlans (available in case 3./4./5.)
 *                    may be an array in case this idea has multiple invitations, recommendedPlans
 *      offerType: [] of one of ('ypHealthCoach', 'campaignActivity', 'campaignPlan', 'personalInvitation', 'publicPlan')
 *            may be an array if this idea was recommended by more than one source
 *      recommendedBy: []   link to the user  who recommended this, in case:
 *          1. a virtual user for our digital health coach
 *          2. a virtual user for the campaign avatar
 *          3. the campaign lead who added the plan
 *          4. the peer who sent the invite
 *          5. the peer who planned the available group activity
 *          may be an array if the same idea has been recommended by multiple sources.
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

    var ideaFilter = req.params.idea;

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
            .select('idea')
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

        // check if idea has already been planned
        if (ideaFilter) {
            var plan = _.find(locals.plans, function (plan) {
                return plan.idea.equals(ideaFilter);
            });
            if (plan) {
                return next(new error.ConflictError('The user has already planned this idea', {
                    ideaId: ideaFilter,
                    activityPlanId: plan.id,
                    reason: 'alreadyPlanned'
                }));
            }
        }


        // check if result is dirty (new answers have been put),
        // then generate and/or load offers, before consolidating them
        if (locals.result && locals.result.dirty) {
            var admin = auth.isAdminForModel(req.user, mongoose.model('Idea'));
            CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.prefs.rejectedIdeas,
                null, req.user.profile.prefs.focus, admin, loadOffers);
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
            if (ideaFilter) {
                selector.idea = req.params.idea;
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
                .populate('idea activityPlan recommendedBy')
                .exec(function (err, offers) {
                    User.populate(offers, { path: 'activityPlan.owner activityPlan.joiningUsers' }, function (err, offers) {

                        consolidate(err, offers);

                    });

                });
        }

        function consolidate(err, offers) {

            var actsToRemove = [];

            if (req.user) {
                var plannedActs = _.map(locals.plans, 'idea');
                var rejActs = _.map(req.user.profile.prefs.rejectedIdeas, 'idea');
                actsToRemove = plannedActs.concat(rejActs);
            }

            // only remove if the user did not request offers for one specific idea
            if (!ideaFilter) {
                _.remove(offers, function (offer) {
                    return _.any(actsToRemove, function (actToRemoveId) {
                        return actToRemoveId.equals(offer.idea._id);
                    });
                });
            }

            // consolidate dups:
            //      if we now have more than one recommendation for the same idea from the different sources
            //      we need to consolidate them into one recommendation with multiple recommenders, sources and possibly plans.
            //      We do this by merging the recommender, the offerType and the plan property into an array.

            // prio them into a object keyed by idea._id to remove dups
            var myOffersHash = {};
            _.forEach(offers, function (offer) {
                if (myOffersHash[offer.idea._id]) {
                    // this act already exists, so we merge
                    var existingRec = myOffersHash[offer.idea._id];
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
                    myOffersHash[offer.idea._id] = offer;
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
                        delete myOffersHash[offer.idea._id];
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

            if ((ideaFilter && sortedOffers.length === 0) || (!ideaFilter && sortedOffers.length < 3)) {
                _getDefaultActivityOffers(ideaFilter, function (err, defaultOffers) {
                    if (err) {
                        return error.handleError(err, next);
                    }

                    sortedOffers = sortedOffers.concat(defaultOffers);

                    // only remove if the user did not request offers for one specific idea
                    if (!ideaFilter) {
                        _.remove(sortedOffers, function (offer) {
                            return _.any(actsToRemove, function (actToRemoveId) {
                                return offer.idea._id.equals(actToRemoveId);
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

        // for offers of offerType recommendation add the count of how many users have planned this idea as part
        // of the campaign
        async.forEach(_.filter(offers, function (offer) {
                return offer.offerType[0] === 'campaignActivity';
            }),
            function (offer, done) {
                ActivityPlan.count(
                    {idea: offer.idea._id || offer.idea,
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
    Idea
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
                _.forEach(activities, function (idea) {

                    var offer = {
                        idea: idea,
                        activityPlan: [],
                        recommendedBy: [healthCoachUser],
                        offerType: ['defaultActivity'],
                        sourceType: 'youpers',
                        prio: idea.qualityFactor
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
