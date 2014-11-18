var _ = require('lodash'),
    mongoose = require('ypbackendlib').mongoose,
    Idea = mongoose.model('Idea'),
    Recommendation = mongoose.model('Recommendation'),
    error = require('ypbackendlib').error,
    async = require('async'),
    Profile = mongoose.model('Profile'),
    config = require('../config/config'),
    log = require('ypbackendlib').log(config),
    SocialInteraction = require('./SocialInteraction');

var NUMBER_OF_COACH_RECS = 3;
var HEALTH_COACH_USER_ID = '53348c27996c80a534319bda';

Profile.on('change:prefs.focus', function (changedProfile) {

    mongoose.model('User').findById(changedProfile.owner).select('campaign').populate('campaign').exec(function (err, user) {
        if (err || !user) {
            log.error(err || "owner of profile not found: " + changedProfile.owner);
            return;
        }
        generateAndStoreRecommendations(changedProfile.owner, user.campaign.topic, changedProfile.prefs.rejectedIdeas, null, changedProfile.prefs.focus, false, function (err, recs) {
            if (err) {
                log.error(err);
            }
        });
    });
});

/**
 * if this is the first login of this user today we generate him a new recommendation
 */
mongoose.model('User').on('User:firstLoginToday', function (user) {

    if (!user || !user.profile || !user.profile._id) {
        throw new Error('user must be present and populated with poulated profile for this event listener');
    }

    var options = {
        rejectedIdeas: user.profile.prefs.rejectedIdeas,
        keepExisting: true
    };

    _updateRecommendations(user._id, options, function (err, newRecs) {
        if (err) {
            throw new Error(err);
        }
    });
});

/**
 * check whether we need to generate a new recommendation.
 */
SocialInteraction.on('socialInteraction:dismissed', function (user, socialInteraction, socialInteractionDismissed) {
    // if the dismissed one is not from the coach there is nothing to do
    if (socialInteraction.authorType !== 'coach') {
        return;
    }

    // check if the user still has non-dismissed coach-recs, only if there are none, we want to create a new one
    SocialInteraction.getAllForUser(user, Recommendation, {authorType: 'coach'}, function (err, currentCoachRecs) {
        if (err) {
            log.error(err);
            throw err;
        }

        if (currentCoachRecs.length > 0) {
            return;
        }

        if (user instanceof mongoose.Types.ObjectId) {
            mongoose.model('User').findById(user).select('+profile +campaign').populate('profile campaign').exec(function (err, populatedUser) {
                if (err) {
                    throw err;
                }
                _generateRec(populatedUser);
            });
        } else {
            _generateRec(user);
        }


        function _generateRec(populatedUser) {
            var options = {
                keepExisting: true,
                rejectedIdeas: populatedUser.profile.prefs.rejectedIdeas,
                topic: populatedUser.campaign.topic
            };
            _updateRecommendations(populatedUser._id, options, function (err, newRecs) {
                if (err) {
                    log.error(err);
                    throw err;
                }
            });
        }

    });


});

/**
 * Evaluate an assessmentResult against a list of ideas and returns a scored list of the ideas
 * that are recommended for someone with this assessmentResult.
 * If no focus are set all available answers are used for scoring, if focus are set only the
 * corresponding answers are used for scoring.
 *
 * The resulting array is ordered by descending score, so the "best" recommendation comes first.
 *
 * @param actList the list of ideas to score
 * @param assResult the assessmentResult to score against
 * @param focus an array of focus-questions corresponding to _ids of assessmentQuestions the user wants to focus on.
 * We expect an array of objects with property question: e.g. [{question: "id", timestamp: "ts"}, ...]
 * If this is null or empty array we consider all questions. If it is set to at least one question, we only consider the
 * questions that the user wants to focus on.
 * @param cb callback function with arguments (err, rec)
 * @returns {*}
 * @private
 */
function _calculateRecommendations(actList, assResult, focus, cb) {

    var indexedAnswers = _.indexBy(assResult.answers, function (answer) {
        return answer.question.toString();
    });

    // calculate matchValue for each idea and store in object
    var matchValues = [], score;
    _.forEach(actList, function (idea) {
        var qualityFactor = idea.qualityFactor || 1;
        score = 1;
        _.forEach(idea.recWeights, function (recWeight) {
            var answerObj = indexedAnswers[recWeight[0].toString()];

            // add score only if
            //     we have an answer for this weight
            //     AND
            //          there are no focus
            //            OR
            //          this answer is part of the focus
            if (answerObj && (!focus || focus.length === 0 || (_.contains(focus, answerObj.question.toString())))) {
                score += (answerObj.answer >= 0) ?
                answerObj.answer / 100 * recWeight[2] :
                Math.abs(answerObj.answer) / 100 * recWeight[1];
            }
        });
        matchValues.push({idea: idea._id, score: score * qualityFactor});
    });

    var sortedRecs = _.sortBy(matchValues, function (matchValue) {
        return -matchValue.score;
    });

    // reset dirty flag for assessment result
    if (assResult.dirty) {
        assResult.dirty = false;
        assResult.save(function (err) {
            if (err) {
                cb(err);
            }
            cb(null, sortedRecs);
        });
    } else {
        cb(null, sortedRecs);
    }

}

var locals = {};

/**
 * loads all ideas relevant
 * @param excludedIdeas
 * @param done
 * @private
 * @param topic
 */
function _loadIdeas(topic, excludedIdeas, done) {
    // reset
    locals.ideas = undefined;

    var finder = {};
    if (topic) {
        finder.topics = topic.toString();
    }

    Idea.find(finder)
        .where({_id: {$not: {$in: excludedIdeas}}})
        .select('recWeights qualityFactor')
        .exec(function (err, ideas) {
            if (err) {
                return error.handleError(err, done);
            }

            locals.ideas = ideas;
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
 * @param topic
 */
function _loadAssessmentResult(userId, assessmentResult, topic, done) {
    locals.assResult = {answers: []};
    return done();
}

/**
 * callback to use
 * @callback cb
 */

/**
 * updates the coachRecommendations that are currently stored for this user.
 *
 * @param {ObjectId | string} userId of the user to update the recs for
 * @param {cb} cb
 * @param options
 */
function _updateRecommendations(userId, options, cb) {

    _.defaults(options, {
        rejectedIdeas: [],
        updateDb: true,
        isAdmin: false,
        keepExisting: false,
        nrOfRecsToReturn: NUMBER_OF_COACH_RECS
    });

    var assessmentResult = options.assessmentResult;
    var focus = options.focus;
    var topic = options.topic;
    var rejectedIdeas = options.rejectedIdeas;
    var nrOfRecsToReturn = options.nrOfRecsToReturn;

    // loading the already planned ideas of this user - we do not want to recommend things that this user has already planned
    mongoose.model('Event').find({
        $or: [
            {owner: userId},
            {joiningUsers: userId}
        ]
    }).select('idea').exec(function (err, plannedIdeas) {
        if (err) {
            return error.handleError(err, cb);
        }

        // we do not want recommendations for this we have already planned or for things that we have rejected in the
        // User Profile
        var excludedIdeas = _.map(rejectedIdeas, 'idea').concat(_.map(plannedIdeas, 'idea'));

        // reset locals;
        locals = {};

        async.parallel([
            _loadIdeas.bind(null, topic, excludedIdeas),
            _loadAssessmentResult.bind(null, userId, assessmentResult, topic)
        ], function (err) {
            if (err) {
                return error.handleError(err, cb);
            }

            if (!locals.assResult) {
                if (!options.isAdmin) {
                    // this user has no assessmentResults so we have no recommendations
                    return cb(null);
                } else {
                    // user is admin so we create an empty assResult for him, with this he gets to see the scores of ideas
                    // with an empty assessment (--> the qualityFactor)
                    locals.assResult = {answers: []};
                }
            }

            _calculateRecommendations(locals.ideas, locals.assResult, focus, function (err, newRecs) {
                if (err) {
                    return cb(err);
                }
                if (options.updateDb) {

                    // find all health coach recommendations for this user
                    Recommendation.find({
                        targetSpaces: {
                            $elemMatch: {
                                type: 'user',
                                targetId: userId
                            }
                        },
                        author: HEALTH_COACH_USER_ID
                    }).exec(function (err, existingRecs) {
                        if (err) {
                            return cb(err);
                        }
                        var previousIdeas = _.map(existingRecs, function (rec) {
                            return rec.idea.toString();
                        });
                        var allCurrentIdeas = _.map(newRecs, function (rec) {
                            return rec.idea.toString();
                        });

                        var obsoleteIdeas = options.keepExisting ? [] : _.difference(previousIdeas, allCurrentIdeas.slice(0, nrOfRecsToReturn));
                        var newIdeas = options.keepExisting ? _.difference(allCurrentIdeas, previousIdeas).slice(0, nrOfRecsToReturn) : _.difference(allCurrentIdeas.slice(0, nrOfRecsToReturn), previousIdeas);

                        // remove recommendation for obsolete ideas
                        var removeRecs = function removeRecs(ideas, done) {
                            Recommendation.remove({
                                targetSpaces: {
                                    $elemMatch: {
                                        type: 'user',
                                        targetId: userId
                                    }
                                },
                                idea: {
                                    $in: ideas
                                }

                            }).exec(done);
                        };

                        // store a recommendation for one new idea
                        var storeRec = function storeRec(idea, done) {
                            var rec = new Recommendation({
                                targetSpaces: [
                                    {
                                        type: 'user',
                                        targetId: userId
                                    }
                                ],
                                author: HEALTH_COACH_USER_ID,
                                authorType: 'coach',
                                idea: idea
                            });
                            rec.save(done);
                        };

                        var updateRecs = [removeRecs.bind(null, obsoleteIdeas)];

                        _.forEach(newIdeas, function (idea) {
                            updateRecs.push(storeRec.bind(null, idea));
                        });

                        async.parallel(updateRecs, function (err, storedRecs) {
                            return cb(err, newRecs.slice(0, options.isAdmin ? 1000 : nrOfRecsToReturn));
                        });

                    });


                } else {
                    return cb(null, newRecs.slice(0, options.isAdmin ? 1000 : nrOfRecsToReturn));
                }


            });
        });


    });


}

/**
 *
 * @param userId
 * @param cb
 * @param options
 */
function generateAndStoreRecommendations(userId, options, cb) {
    options.updateDb = true;
    _updateRecommendations(userId, options, cb);
}

function generateRecommendations(userId, options, cb) {
    options.updateDb = false;
    _updateRecommendations(userId, options, cb);
}


// keeping as a reference, currently not in use
var getDefaultRecommendations = function getDefaultRecommendations(campaignId, cb) {

    Idea
        .find({}, {}, {sort: {'qualityFactor': -1}, limit: 8})
        .exec(function (err, ideas) {

            if (err) {
                cb(err);
            }

            var recs = [];
            _.forEach(ideas, function (idea) {

                var recommendation = {

                    targetSpaces: [
                        {
//                                type: 'campaign',
//                                targetId: campaign.id
                        }
                    ],

                    author: HEALTH_COACH_USER_ID,

                    refDocs: [
                        {docId: campaignId, model: 'Campaign'}
                    ],
                    idea: idea._id
                };


                recs.push(recommendation);
            });

            return cb(null, recs);
        });
};


module.exports = {
    generateAndStoreRecommendations: generateAndStoreRecommendations,
    generateRecommendations: generateRecommendations,
    getDefaultRecommendations: getDefaultRecommendations,

    healthCoachUserId: HEALTH_COACH_USER_ID
};
