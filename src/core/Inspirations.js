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
    'freddy': ['53b416cfa43aac62a2debda1'], // food
    'susan': ['53b416fba43aac62a2debda3'],  // social
    'adam': ['53b416fba43aac62a2debda2'], //
    'allison': ['53b416cfa43aac62a2debda1', '53b416fba43aac62a2debda3', '53b416fba43aac62a2debda2']
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
function getIdeaMatchScore(idea, userCoach, userCats, userEvents, userInvitations, userDismissals) {

    var qf = idea.qualityFactor;

    // coachMatch = 1 + number of intersecting topics between user's coach's topics and idea's topics
    var coachMatch = 1 + _.intersection(coach2Topic[userCoach], _.map(idea.topics, function (topic) {
            return topic.toString();
        })).length;

    var categoryMatch = 1 + _.intersection(userCats, idea.categories).length;

    // calculating planningMatch
    var now = new Date();

    var hasFuturePlan = _.find(userEvents, function (event) {
        return event.start > now;
    });
    var hasInvitation = userInvitations && userInvitations.length >= 1;
    var hasEverPlanned = _.find(userEvents, function (event) {
        return event.start < now;
    });

    var planningMatch = 1;
    if (hasFuturePlan || hasInvitation) {
        planningMatch = 0.1;
    }
    if (hasEverPlanned) {
        planningMatch = 2;
    }

    var dismissalFactor = Math.pow(0.3, (userDismissals && userDismissals.length) || 0);

    var ideaScore = qf * coachMatch * categoryMatch * planningMatch * dismissalFactor;
    log.info({
        idea: idea.titleI18n.de,
        qf: qf,
        coachMatch: coachMatch,
        categoryMatch: categoryMatch,
        planningMatch: planningMatch,
        dismissalFactor: dismissalFactor,
        ideaScore: ideaScore
    });

    return ideaScore;
}


/**
 * We expect an array of objects with property question: e.g. [{question: "id", timestamp: "ts"}, ...]
 * If this is null or empty array we consider all questions. If it is set to at least one question, we only consider the
 * questions that the user wants to focus on.
 * @returns {*}
 * @private
 * @param user
 * @param invitations
 * @param dismissals
 * @param done
 */

function getIdeaMatchScores(user, invitations, dismissals, done) {
    // load all the stuff we need
    var locals = {

    };


    async.parallel([
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
                    locals.events = plannedEvents;
                    return cb();
                });
            },
            function loadIdeas(cb) {
                Idea.find()
                    .select('qualityFactor')
                    .exec(function (err, ideas) {
                        if (err) {
                            return error.handleError(err, cb);
                        }
                        locals.ideas = ideas;
                        return cb();
                    });
            }],
        function (err) {
            if (err) {
                return done(err);
            }

            var userCats = user.profile.categories;
            var coach = user.profile.coach;

            _.forEach(locals.ideas,
                function(idea, cb) {

                    var ideaFilter = function(obj) {return obj.idea.toString() === idea._id.toString();};
                    var events = _.filter(locals.events, ideaFilter);
                    var invitations = _.filter(invitations, ideaFilter);
                    var dismissals = _.filter(dismissals, ideaFilter);
                    idea.ideaScore = getIdeaMatchScore(idea, userCats, coach, events, invitations, dismissals);
                });
            return done(null, _.sortBy(locals.ideas, 'ideaScore'));
        });
}


function getInspirations(user, done) {

    function _loadSocialInteractions(cb) {
        SocialInteraction.getAllForUser(user, mongoose.model('SocialInteraction'), {dismissed: true}, function (err, sois) {
            if (err) {
                return cb(err);
            }

            var locals = {};

            // TODO: sort invitations by distance to user's home
            locals.publicInvitations = _.filter(sois, function (soi) {
                return soi.__t === 'Invitation' && !soi.dismissed && soi.targetSpaces[0].type==='campaign';
            });

            // TODO: sort invitations by distance to user's home
            locals.personalInvitations = _.filter(sois, function (soi) {
                return soi.__t === 'Invitation' && !soi.dismissed && soi.targetSpaces[0].type==='user';
            });

            locals.dismissals = _.filter(sois, function (soi) {
                return soi.dismissed;
            });
            return cb(null, locals);
        });
    }

    _loadSocialInteractions(function(err, result) {
        if (err) {
            return done(err);
        }
        getIdeaMatchScores(user, result.publicInvitations.concat(result.personalInvitations), result.dismissals, function(err, scoredIdeas) {
            if (err) {
                return done(err);
            }
            var inspirations = [];

            if (result.publicInvitations.length > 0) {
                inspirations.push(result.publicInvitations[0]);
            }
            if (result.personalInvitations.length > 0) {
                inspirations.push(result.personalInvitations[0]);
            }

            var scoredIdeaIndex = scoredIdeas.length -1;
            while (inspirations.length < 3) {
                var rec = new Recommendation({
                    targetSpaces: [
                        {
                            type: 'user',
                            targetId: user._id
                        }
                    ],
                    author: HEALTH_COACH_USER_ID,
                    authorType: 'coach',
                    idea: scoredIdeas[scoredIdeaIndex--]._id
                });

                inspirations.push(rec);
            }
            return done(null, inspirations);

        });
    });

}

module.exports = {
    getInspirations: getInspirations,
    getIdeaMatchScore: getIdeaMatchScore,
    getIdeaMatchScores: getIdeaMatchScores
};