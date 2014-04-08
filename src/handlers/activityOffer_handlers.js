var mongoose = require('mongoose'),
    ActivityPlan = mongoose.model('ActivityPlan'),
    ActivityOffer = mongoose.model('ActivityOffer'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    _ = require('lodash'),
    error = require('../util/error'),
    utils = require('./handlerUtils'),
    auth = require('../util/auth'),
    generic = require('./generic'),
    Notification = require('../core/Notification');

function _publishNotificationForOffer(activityOffer, author, cb) {

    activityOffer.populate('activity', 'titleI18n',

        function (err, populatedOffer) {

            if (err) {
                return cb(err);
            }

            return new Notification({
                type: 'activityRecommendation',
                title: populatedOffer.activity.title,
                targetQueue: populatedOffer.targetQueue,
                author: author,
                refDocLink: "http://TODOaddALinkHere",
                refDocId: activityOffer._id,
                refDocModel: 'ActivityOffer'
            }).publish(cb);
        });
}

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

    _publishNotificationForOffer(offer, req.user, saveOfferAndSendToClientCb);

    function saveOfferAndSendToClientCb(err, notification) {
        if (err) {
            return error.handleError(err, next);
        }

        offer.save(generic.writeObjCb(req, res, next));
    }
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
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function getActivityOffersFn(req, res, next) {

    if (!req.user) {
        return next(new error.UnauthorizedError());
    }

    // load currently active plans for this user, because we do not want to display offers that he has
    // already planned
    ActivityPlan
        .find({
            owner: req.user._id,
            status: 'active'})
        .select('activity')
        .exec(function (err, plans) {
            if (err) {
                error.handleError(err, next);
            }

            var plannedActs = _.map(plans, 'activity');

            var targetQueues = [req.user._id];
            if (req.user.campaign) {
                targetQueues.push(req.user.campaign._id);
            }

            ActivityOffer
                .find({targetQueue: {$in: targetQueues}})
                .populate('activity activityPlan recommendedBy')
                .exec(function (err, offers) {
                    if (err) {
                        return error.handleError(err, next);
                    }

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

                    // sort them into a object keyed by activity._id to remove dups
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

                    // sort and limit:
                    //      we want to display the best/most important recommendation first
                    //      we only want to deliver a limited number of recommendations
                    res.send(_.sortBy(myOffersHash, function (offer) {
                        return -1 * _.max(offer.prio);
                    }).slice(0, 10));
                    return next();
                });


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
