var mongoose = require('mongoose'),
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
    generic = require('./generic');


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
        actMgr.emit('activity:offerSaved', savedOffer);
        return generic.writeObjCb(req, res, next)(err, savedOffer);
    });

}

function getCoachRecommendationsFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    var admin = auth.isAdminForModel(req.user, mongoose.model('Activity'));

    CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.userPreferences.rejectedActivities, null, null, admin, function (err, recs) {
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
 *      type: [] of one of ('ypHealthCoach', 'campaignActivity', 'campaignPlan', 'personalInvitation', 'publicPlan')
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
 * - with a preferred offer type of:
 *
 * -- campaignActivityPlan
 * -- ypHealthCoach
 * -- personalInvitation
 *
 * - and in case no more offers with this type are available,
 *   the next highest rated offer type according to:
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

    if (!req.user) {
        return next(new error.UnauthorizedError());
    }

    var locals = {};


    // load currently active plans for this user, because we do not want to display offers that he has
    // already planned
    var getActivityPlans = function getActivityPlans(done) {

        ActivityPlan
            .find({
                owner: req.user._id,
                status: 'active'})
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
            .find({}, {}, { sort: { 'created_at' : -1 }}).exec(function (err, results) {
                if (err) {
                    return done(err);
                }

                locals.result = results.length > 0 ? results[0] : undefined;
                return done();
            });

    };


    async.parallel([ getActivityPlans, getAssessmentResult], function(err) {

        if (err) {
            return error.handleError(err, next);
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
            if (req.params.activity) {
                selector.activity = req.params.activity;
            }

            ActivityOffer
                .find(selector)
                .populate('activity activityPlan recommendedBy')
                .exec(consolidate);
        }

        // check if result is dirty (new answers have been put),
        // then generate and/or load offers, before consolidating them
        if(locals.result && locals.result.dirty) {
            var admin = auth.isAdminForModel(req.user, mongoose.model('Activity'));
            CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.userPreferences.rejectedActivities,
                null, null, admin, loadOffers);
        } else {
            loadOffers();
        }

        function consolidate(err, offers) {


            var plannedActs = _.map(locals.plans, 'activity');

            _.remove(offers, function (offer) {
                return _.any(plannedActs, function (plannedActId) {
                    return plannedActId.equals(offer.activity._id);
                });
            });

            if (!offers || offers.length === 0) {
                res.send([]);
                return next();
            }

            // removeRejected:
            //      the user may have rejected Activities in his profile (when he clicked "not for me" earlier). We need
            //      to remove them from the recommendations.
            var rejActs = req.user.profile.userPreferences.rejectedActivities;
            if (rejActs.length > 0) {
                _.remove(offers, function (rec) {
                    return _.any(rejActs, function (rejAct) {
                        return rejAct.equals(rec.activity._id);
                    });
                });
            }

            // consolidate dups:
            //      if we now have more than one recommendation for the same activity from the different sources
            //      we need to consolidate them into one recommendation with multiple recommenders, sources and possibly plans.
            //      We do this by merging the recommender, the type and the plan property into an array.

            // prio them into a object keyed by activity._id to remove dups
            var myOffersHash = {};
            _.forEach(offers, function (offer) {
                if (myOffersHash[offer.activity._id]) {
                    // this act already exists, so we merge
                    var existingRec = myOffersHash[offer.activity._id];
                    existingRec.activityPlan = existingRec.activityPlan.concat(offer.activityPlan);
                    existingRec.recommendedBy = existingRec.recommendedBy.concat(offer.recommendedBy);
                    existingRec.type = existingRec.type.concat(offer.type);
                    existingRec.prio = existingRec.prio.concat(offer.prio);
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

                return function(offer) {

                    for(var priority=typesLowestToHighestPriority.length; priority>0; priority--) {

                        if(_.contains(offer.type, preferredType)) {
                            return -6;
                        } else if(_.contains(offer.type, typesLowestToHighestPriority[priority])) {
                            return - priority;
                        }
                    }
                };
            };

            var addOfferByType = function addOfferByType(preferredType) {

                var sortedByType = _.sortBy(myOffersHash, priority(preferredType));

                if(sortedByType.length > 0) {

                    var offer = sortedByType[0];

                    // limit to 3 per type
                    var maxPerType = 3;

                    var countPerType = _.filter(sortedOffers, function(o) {
                        return _.any(o.type, function(type) {
                            return _.contains(offer.type, type);
                        });
                    }).length;

                    if(countPerType < maxPerType) {
                        sortedOffers.push(offer);
                        delete myOffersHash[offer.activity._id];
                    }

                }
            };

            var sortedOffers = [];

            for(var k=0; k<3; k++) {
                addOfferByType('campaignActivityPlan');
                addOfferByType('ypHealthCoach');
                addOfferByType('personalInvitation');
            }

            // add all personalInvitations

            sortedOffers.concat(_.filter(myOffersHash, function(offer) {
                return _.contains(offer.type, 'personalInvitation');
            }));

            // fill up to 9 with publicActivityPlans
            if(sortedOffers.length < 9) {
                var publicPlans = _.filter(myOffersHash, function(offer) {
                    return _.contains(offer.type, 'publicActivityPlan');
                });
                sortedOffers.concat(publicPlans.slice(0, 9 - sortedOffers.length));
            }

            res.send(sortedOffers);
            return next();
        }


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
            obj.remove();
        });
        res.send(200);
    });
};

module.exports = {
    getCoachRecommendationsFn: getCoachRecommendationsFn,
    getActivityOffersFn: getActivityOffersFn,
    postActivityOfferFn: postActivityOffer,
    deleteActivityOffersFn: deleteActivityOffers
};
