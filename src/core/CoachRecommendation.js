var _ = require('lodash'),
    mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    ActivityOffer = mongoose.model('ActivityOffer'),
    error = require('../util/error'),
    async = require('async');

var NUMBER_OF_COACH_RECS = 10;
var HEALTH_COACH_USER_ID = '53348c27996c80a534319bda';
var HEALTH_COACH_TYPE = 'ypHealthCoach';

/**
 * Evaluate an assessmentResult against a list of activities and returns a scored list of the activities
 * that are recommended for someone with this assessmentResult.
 * If no personalGoals are set all available answers are used for scoring, if personalGoals are set only the
 * corresponding answers are used for scoring.
 *
 * The resulting array is ordered by descending score, so the "best" recommendation comes first.
 *
 * @param actList the list of activities to score
 * @param assResult the assessmentResult to score against
 * @param personalGoal an array of goals corresponding to _ids of assessmentQuestions the user wants to focus on. If
 * this is null or empty array we consider all questions. If it is set to at least one question, we only consider the
 * questions that the user wants to focus on.
 * @param nrOfRecsToReturn
 * @param cb callback function with arguments (err, rec)
 * @returns {*}
 * @private
 */
function _generateRecommendations(actList, assResult, personalGoal, nrOfRecsToReturn, cb) {
    if (_.isString(personalGoal) && personalGoal.length > 0 ) {
        personalGoal = [personalGoal];
    } else if (_.isArray(personalGoal) && (personalGoal.length = 0)) {
        personalGoal = undefined;
    }

    // calculate matchValue for each activity and store in object
    var matchValues = [], score;
    _.forEach(actList, function (activity) {
        var qualityFactor = activity.qualityFactor || 1;
        score = 1;
        _.forEach(activity.recWeights, function (recWeight) {
            var answerObj = _.find(assResult.answers, function (ans) {
                return _.isString(ans.question) ? ans.question === recWeight[0] : ans.question.equals(recWeight[0]);
            });

            // add score only if
            //     we have an answer for this weight
            //     AND
            //          there are no personalGoals
            //            OR
            //          this answer is part of the personalGoals
            if (answerObj && (!personalGoal || (_.contains(personalGoal, answerObj.question.toString())))) {
                score += (answerObj.answer >= 0) ?
                    answerObj.answer / 100 * recWeight[2] :
                    Math.abs(answerObj.answer) / 100 * recWeight[1];
            }
        });
        matchValues.push({activity: activity._id, score: score * qualityFactor});
    });

    var sortedRecs = _.sortBy(matchValues, function (matchValue) {
        return -matchValue.score;
    });

    var limitedRecs = sortedRecs.slice(0,nrOfRecsToReturn);
    return cb(null, limitedRecs);
}

var locals = {};

/**
 * loads all activities relevant
 * @param rejectedActivities
 * @param done
 * @private
 */
function _loadActivities(rejectedActivities, done) {
    // reset
    locals.activities = undefined;

    Activity
        .find()
        .select('recWeights qualityFactor')
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

/**
 * loads the assessmentResult if the passed in parameter is empty and stores it to the locals object.
 * If there is already an assessmentResult passed in, it is just stored to locals without loading from DB.
 *
 * @param userId
 * @param assessmentResult or null
 * @param done callback
 * @returns {*}
 * @private
 */
function _loadAssessmentResult(userId, assessmentResult, done) {
    // reset
    locals.assResult = undefined;

    if (assessmentResult) {
        locals.assResult = assessmentResult;
        return done();
    } else {
        AssessmentResult.find({owner: userId})
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
}

/**
 * removes the existing CoachRecommendations for the passed in user from the ActivityOffers Collection
 *
 * @param userId
 * @param cb
 * @private
 */
function _removeOldRecsFromActivityOffers(userId, cb) {
    // mongo/mogoose automagically query the 'type' attribute, which is actually an array, by doing
    // this here. It means: find documents with 'type' array that contains HEALTH_COACH_TYPE
    ActivityOffer.find({targetUser: userId, type: HEALTH_COACH_TYPE})
        .remove()
        .exec(
        function(err) {
            return cb(err);
        }
    );
}

/**
 * takes coachrecomendations, turns them into complete ActivityOffers and stores them
 * into the ActivityOffers collection.
 *
 * @param userId
 * @param recs
 * @param cb
 * @private
 */
function _storeNewRecsIntoActivityOffers(userId, recs, cb) {
    async.forEach(recs, function(rec, done) {
        var newOffer = new ActivityOffer({
            activity: rec.activity,
            type: [HEALTH_COACH_TYPE],
            recommendedBy: [HEALTH_COACH_USER_ID],
            targetQueue: userId,
            prio: [rec.score]
        });

        newOffer.save(done);
    }, function(err) {
        return cb(err);
    });
}

/**
 * callback to use
 * @callback cb
 */

/**
 * updates the coachRecommendations that are currently stored for this user.
 * if the rejectedActs, personalGoals and last assessmentResult are not passed in, the method tries to load
 * them from the database
 *
 * @param {ObjectId | string} userId of the user to update the recs for
 * @param {ObjectId[] | string[]} rejectedActs the list of rejected activities as Ids
 * @param {AssessmentResult} assessmentResult
 * @param {ObjectId | ObjectId[] | string | string[] } [personalGoals]
 * @param {cb} cb
 * @param updateDb
 * @param isAdmin
 */
function _updateRecommendations(userId, rejectedActs, assessmentResult, personalGoals, updateDb, isAdmin, cb) {
    // TODO: load personalGoals of this user if not passed in
    // TODO: load rejectedActs of this user if not passed in

    async.parallel([
        _loadActivities.bind(null, rejectedActs),
        _loadAssessmentResult.bind(null, userId, assessmentResult)
    ], function (err) {
        if (err) {
            return error.handleError(err, cb);
        }

        if (!locals.assResult) {
            // this users has no assessmentResults so we have no recommendations
            return cb(null);
        }

        _generateRecommendations(locals.activities, locals.assResult, personalGoals, isAdmin ? 1000: NUMBER_OF_COACH_RECS, function (err, recs) {
            if (err) {
                return cb(err);
            }
            if (updateDb) {
                async.parallel([
                    _removeOldRecsFromActivityOffers.bind(null, userId),
                    _storeNewRecsIntoActivityOffers.bind(null, userId, recs)
                ], function (err) {
                    return cb(err, recs);
                });
            } else {
                return cb(null, recs);
            }


        });
    });

}

/**
 *
 * @param userId
 * @param rejectedActs
 * @param assessmentResult
 * @param personalGoals
 * @param cb
 * @param isAdmin
 */
function generateAndStoreRecommendations(userId, rejectedActs, assessmentResult, personalGoals, isAdmin, cb) {
    _updateRecommendations(userId, rejectedActs, assessmentResult, personalGoals, true, isAdmin,  cb);
}

/**
 *
 * @param userId
 * @param rejectedActs
 * @param assessmentResult
 * @param personalGoals
 * @param cb
 * @param isAdmin
 */
function generateRecommendations(userId, rejectedActs, assessmentResult, personalGoals, isAdmin, cb) {
    _updateRecommendations(userId, rejectedActs, assessmentResult, personalGoals, false, isAdmin, cb);
}

module.exports = {
    generateAndStoreRecommendations: generateAndStoreRecommendations,
    generateRecommendations: generateRecommendations
};
