var _ = require('lodash'),
    mongoose = require('ypbackendlib').mongoose,
    Idea = mongoose.model('Idea'),
    Recommendation = mongoose.model('Recommendation'),
    error = require('ypbackendlib').error,
    async = require('async'),
    config = require('../config/config'),
    log = require('ypbackendlib').log(config),
    SocialInteraction = require('./SocialInteraction');

var HEALTH_COACH_USER_ID = '53348c27996c80a534319bda';


var coach2Topic = {
    'alex': ['53b416cfa43aac62a2debda1'], // food
    'lisa': ['53b416fba43aac62a2debda3'],  // social
    'marco': ['53b416fba43aac62a2debda2'], // activity
    'nora': ['53b416cfa43aac62a2debda1', '53b416fba43aac62a2debda3', '53b416fba43aac62a2debda2']
};

/**
 *
 * -------------
 * Inspirations for this user.
 * goal: interesting inspirations for this user.
 *
 * 1. get all possible inspirations
 *      - (a) all personal invitations,
 *          - sort by ideaMatchScore (see below)
 *      - (b) all public invitations (where Inspiration finds people, inviteOthers)
 *          - limit to 30km distance:  event.location to user.profile.location
 *          - sort  by ideaMatchScore (see below)
 *      - (c) current recommendations (see below)
 * 2. sort and limit:
 *      if possible return one of each type (a) (b),(c), otherwise fill up with what we have
 *      limit to 3 (or more?)
 *
 * --------
 * Recommendations for the current user:
 *
 * Simple Algorithm:
 *
 * 1. score all available ideas by
 *
 * ideaMatchScore  = qualityFactor * coachMatch * categoryMatch * planningMatch * 0.3^dismissals    where
 *
 * - qualityFactor = fixed configured number between 1-10 that allows us to favor some 'good' ideas over others we consider less "demonstratable"
 * - coachMatch = 1 or 2, depending whether the user's chosen coach promotes the topic of this idea
 * - categoryMatch = 1 or 2, depending whether the user has set the idea's categories as 'favoured' in his profile.
 * - planningMatch = 0: if the user has planned this idea in future to execute in his agenda or has a current "invitation"
 *                      for it (Personal or Public)
 *                   1: if the user has never done that idea and not planned it in future
 *                   2: if the user has done this before (and "liked it", as soon as we get this data ;-)
 * - dismissals = number of times the user has dismissed this idea before (invitation or recommendation)
 *
 * 2. rank all ideas by score
 * 3. generate recommendations for the top X (configurable)
 *
 * @param
 */
function getIdeaMatchScore(idea, parameters) {
    var userCoach = parameters.userCoach;
    var userCats = parameters.userCats;
    var futurePlanCount = parameters.futurePlanCount || 0;
    var pastPlanCount = parameters.pastPlanCount || 0;
    var openInvitationCount = parameters.openInvitationCount || 0;
    var dismissalsCount = parameters.dismissalsCount || 0;

    var qf = idea.qualityFactor;

    // coachMatch = 1 + number of intersecting topics between user's coach's topics and idea's topics
    var coachMatch = 1 + _.intersection(coach2Topic[userCoach], _.map(idea.topics, function (topic) {
            return topic.toString();
        })).length;

    var categoryMatch = 1 + _.intersection(userCats, idea.categories).length;


    var planningMatch = 1;
    if (futurePlanCount > 0 || openInvitationCount > 0) {
        planningMatch = 0.1;
    }
    if (pastPlanCount > 0) {
        planningMatch = 2 * planningMatch;
    }

    var dismissalFactor = Math.pow(0.05, dismissalsCount);

    var ideaScore = qf * coachMatch * categoryMatch * planningMatch * dismissalFactor;
    log.trace({
        idea: idea.titleI18n.en,
        qf: qf,
        coachMatch: coachMatch,
        categoryMatch: categoryMatch,
        planningMatch: planningMatch,
        dismissalFactor: dismissalFactor,
        ideaScore: ideaScore
    }, 'scored idea: ' + idea.number);

    return ideaScore;
}


/**
 * We expect an array of objects with property question: e.g. [{question: "id", timestamp: "ts"}, ...]
 * If this is null or empty array we consider all questions. If it is set to at least one question, we only consider the
 * questions that the user wants to focus on.
 * @returns {*}
 * @private
 * @param user
 * @param allInvitations
 * @param allDismissals
 * @param done
 */

function getIdeaMatchScores(user, ideas, userData, done) {

    _.forEach(ideas,
        function (idea, cb) {

            var params = {
                userCoach: user.profile.coach,
                userCats: user.profile.categories,
                futurePlanCount: userData.eventCountByIdeaAndNow[idea._id.toString() + 'future'],
                pastPlanCount: userData.eventCountByIdeaAndNow[idea._id.toString() + 'past'],
                openInvitationCount: userData.invitationCountByIdea[idea._id.toString()],
                dismissalsCount: userData.dismissalCountByIdea[idea._id.toString()]
            };

            idea.ideaScore = getIdeaMatchScore(idea, params);
        });
    function pad(str, max) {
        str = str.toString();
        return str.length < max ? pad("0" + str, max) : str;
    }

    return done(null, _.sortBy(ideas, function (idea) {

        return pad(idea.ideaScore.toFixed(5), 15) + idea.number;
    }));
}

function loadScoringData(user, queryOptions, locale, done) {

    if (_.isUndefined(done)) {
        done = locale;
    }
    if (_.isUndefined(locale)) {
        done = queryOptions;
    }
    if (_.isUndefined(done) || !_.isFunction(done)) {
        throw new error.MissingParameterError('parameters user and callback are required');
    }

    var locals = {userData: {}};

    async.parallel(
        [
            // loading the already planned events of this user - we do not want to recommend things that this user has already planned
            function loadEvents(cb) {
                mongoose.model('Event').find({
                    $or: [
                        {owner: user._id},
                        {joiningUsers: user._id}
                    ]
                }).select('idea start').exec(function (err, plannedEvents) {
                    if (err) {
                        return cb(err);
                    }
                    var now = new Date();
                    var eventCountByIdeaAndNow = _.countBy(plannedEvents, function (event) {
                        return event.idea.toString() + (event.start > now ? 'future' : 'past');
                    });

                    locals.userData.eventCountByIdeaAndNow = eventCountByIdeaAndNow;
                    return cb();
                });
            },
            function loadIdeas(cb) {
                Idea.find()
                    .select('+qualityFactor')
                    .exec(function (err, ideas) {
                        if (err) {
                            return error.handleError(err, cb);
                        }
                        locals.ideas = ideas;
                        return cb();
                    });
            }, function loadSois(cb) {
            return _loadSocialInteractions(queryOptions, cb);
        }
        ], function (err) {
            if (err) {
                return done(err);
            }

            return done(null, locals);

        });


    function _loadSocialInteractions(queryOptions, cb) {
        SocialInteraction.getAllForUser(user, mongoose.model('SocialInteraction'), {
            dismissed: true,
            queryOptions: queryOptions,
            locale: locale
        }, function (err, sois) {
            if (err) {
                return cb(err);
            }

            // TODO: sort invitations by distance to user's home
            locals.userData.publicInvitations = _.filter(sois, function (soi) {
                return soi.__t === 'Invitation' && !soi.dismissed && soi.targetSpaces[0].type === 'campaign';
            });

            // TODO: sort invitations by distance to user's home
            locals.userData.personalInvitations = _.filter(sois, function (soi) {
                return soi.__t === 'Invitation' && !soi.dismissed && soi.targetSpaces[0].type === 'user';
            });

            locals.userData.dismissals = _.filter(sois, function (soi) {
                return soi.dismissed;
            });

            locals.userData.activeRecommendations = _.filter(sois, function (soi) {
                return !soi.dismissed && soi.__t === 'Recommendation';
            });

            locals.userData.invitationCountByIdea = _.countBy(locals.userData.publicInvitations.concat(locals.userData.personalInvitations), 'idea');
            locals.userData.dismissalCountByIdea = _.countBy(locals.userData.dismissals, 'idea');

            return cb(null, locals);
        });
    }

}


function getInspirations(user, queryOptions, locale, finalDone) {
    if (_.isUndefined(finalDone)) {
        finalDone = locale;
        locale = 'en';
    }
    if (_.isUndefined(finalDone)) {
        finalDone = queryOptions;
        queryOptions = {};
    }
    if (_.isUndefined(finalDone) || !_.isFunction(finalDone)) {
        throw new error.MissingParameterError('parameters user and callback are required');
    }

    loadScoringData(user, queryOptions, locale, function (err, result) {
        if (err) {
            return finalDone(err);
        }

        getIdeaMatchScores(user, result.ideas, result.userData, function (err, scoredIdeas) {
            if (err) {
                return finalDone(err);
            }
            var inspirations = [];
            var recsToSave = [];

            if (result.userData.publicInvitations.length > 0) {
                inspirations.push(result.userData.publicInvitations[0]);
            }
            if (result.userData.personalInvitations.length > 0) {
                inspirations.push(result.userData.personalInvitations[0]);
            }

            var existingActiveRecs = result.userData.activeRecommendations;

            var scoredIdeaIndex = scoredIdeas.length - 1;

            while (inspirations.length < 3) {

                var ideaToRec = scoredIdeas[scoredIdeaIndex--];

                // check whether we already have an active rec for this idea:

                /* jshint loopfunc: true */
                var recs = _.remove(existingActiveRecs, function _ideaIdComparator(activeRec) {
                    return ((activeRec.idea._id && activeRec.idea._id.toString()) || activeRec.idea.toString()) === ideaToRec.id;
                });

                if (recs.length > 1) {
                    throw new Error('should never happen');
                }
                var rec;

                if (recs.length === 1) {
                    rec = recs[0];
                } else {
                    rec = new Recommendation({
                        targetSpaces: [
                            {
                                type: 'user',
                                targetId: user._id
                            }
                        ],
                        author: HEALTH_COACH_USER_ID,
                        authorType: 'coach',
                        idea: ideaToRec
                    });
                    recsToSave.push(rec);
                }
                inspirations.push(rec);
            }
            async.forEach(recsToSave, function (rec, cb) {
                rec.save(cb);
            }, function (err) {
                if (err) {
                    return finalDone(err);
                }

                if (existingActiveRecs.length > 0) {
                    async.forEach(existingActiveRecs, function (rec, cb) {
                        rec.remove(cb);
                    });
                }
                // repopulate ideas on saved recs)
                Idea.populate(inspirations, {path: "idea"}, function (err) {
                    return finalDone(null, inspirations);
                });
            });
        });
    });

}

module.exports = {
    getInspirations: getInspirations,
    getIdeaMatchScore: getIdeaMatchScore,
    getIdeaMatchScores: getIdeaMatchScores,
    loadScoringData: loadScoringData
};