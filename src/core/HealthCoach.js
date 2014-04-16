var async = require('async'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment'),
    RulesEngine = require('../util/rulesEngine');

/**
 * The ruleset to find out what coachmessages to display under which conditions. This
 * ruleset will return the list of messageIds to display.
 *
 * @type {{returnType: string, rules: {id: string, rule: string}[]}}
 */
var healthCoachRuleSet = {
    returnType: "MatchingRuleId",
    rules: [
        {id: "hcmsg.1", rule: "facts.uistate == 'home.content' && !facts.assessmentResult.done"},
        {id: "hcmsg.2", rule: "facts.uistate == 'home.content' && facts.assessmentResult.done && facts.assessmentResult.age > 1000*60*60*24*3"},
        {id: "hcmsg.3", rule: "facts.uistate == 'home.content' && facts.activities.total.plannedAct == 0"},
        {id: "hcmsg.4", rule: "facts.uistate == 'select.content' && !facts.assessmentResult.done"}
    ]
};

/**
 * the list of facts that the rules can use as base data. Each fact is defined as a an object with:
 * {
 *  name: the name of the fact. this is then to be used in the rule to access the data
 *  description: a description what information this fact will provide
 *  calc: the function that will calculate this fact. this function will take a userId and a callback function (err, calculatedFact).
 *  default: the value to be used in case we have no authenticated user account to calculate against. Is used to display
 *            coachmessages also for users that are not logged in.
 * }
 * @type {*[]}
 */
var commonFacts = [
        {
            name: 'assessmentResult',
            description: 'provides information about the state of the self assessment for a user:' +
                'done: (Boolean) whether he has filled out the assessment' +
                'completion (float: 0..1)the completion state of the assessment' +
                'age: (int) the seconds since the user last updated the assessment',
            calc: function (userId, cb) {
                mongoose.model('AssessmentResult').aggregate([
                        {$match: {owner: userId}},
                        {$sort: {timestamp: -1}},
                        {$limit: 1}
                    ],
                    function (err, result) {

                        if (err) {
                            return cb(err);
                        }
                        var fact = {
                            done: false
                        };

                        if (!result) {
                            return cb(null, fact);
                        }
                        if (result.length === 1) {
                            fact.done = true;
                            fact.completion = '1';
                            fact.age = moment().diff(moment(result[0].timestamp));
                        }

                        return cb(null, fact);
                    });
            },
            default: {
                done: false,
                completion: 0
            }
        },
        {
            name: 'activities',
            description: 'provides information about how many activities a user has planned, done, missed' +
                'total: {plannedAct: # of planned activities, future: # of events planned in futuer, missed: # of missed events, done: # of done events, open: # of not reported on events},' +
                'last7days: {missed: # of missed events, done: # of done events, open: # of not reported on events},' +
                'next7days: {planned: # of planned activities}',
            calc: function (userId, cb) {
                var self = this;
                mongoose.model('ActivityPlan').find({owner: userId}).exec(
                    function (err, plans) {
                        if (err) {
                            return cb(err);
                        }

                        var fact = _.clone(self.default);
                        if (!plans || !plans.length || plans.length === 0) {
                            return cb(null, fact);
                        }

                        var now = moment();

                        _.forEach(plans, function (plan) {
                            fact.total.plannedAct++;
                            _.forEach(plan.events, function (event) {
                                // event in future or passed
                                if (now.diff(moment(event.begin)) < 0) {
                                    // future
                                    fact.total.future++;
                                    if (now.diff(moment(event.begin), 'days') > -7) {
                                        // less than 7 days in the future
                                        fact.next7Days.planned++;
                                    }
                                } else {
                                    // event in the past
                                    fact.total[event.status]++;
                                    if (now.diff(moment(event.begin), 'days') < 7) {
                                        // less then 7 days passed
                                        fact.last7Days[event.status]++;
                                    }

                                }

                            });
                        });

                        return cb(null, fact);
                    }
                );
            },
            default: {
                total: {
                    plannedAct: 0,
                    future: 0,
                    missed: 0,
                    done: 0,
                    open: 0
                },
                next7Days: {
                    planned: 0
                },
                last7Days: {
                    open: 0,
                    missed: 0,
                    done: 0
                }

            }
        },
        {
            name: 'goals',
            description: 'number of set goals in the current challenge',
            calc: function (userId, cb) {
                return cb(null, []);
            }
        }
    ]
    ;

/**
 * Helper object that calculates the Facts for a given user.
 * the user object and the uistate are always added to the Facts objects, so their properties can be used in rules.
 *
 * @param user
 * @param uistate
 * @constructor
 */
function Facts(user, uistate) {
    var self = this;
    self.user = user;
    self.uistate = uistate;


    self.init = function (cb) {
        // get the commonly used facts for this user
        async.forEachLimit(commonFacts, 5, function (commonFact, done) {
            if (!user) {
                self[commonFact.name] = _.clone(commonFact.default);
                return done();
            } else {
                commonFact.calc(user._id, function (err, fact) {
                    if (err) {
                        return done(err);
                    }
                    self[commonFact.name] = fact;
                    return done();
                });
            }
        }, function (err) {
            if (err) {
                return cb(err, self);
            }
            return cb();

        });
    };

}

/**
 * the health Coach, supports only one method
 *      getCurrentMessages(user, uistate, cb(err, messages, facts))
 * @constructor
 */
function HealthCoach() {
    var re = new RulesEngine(healthCoachRuleSet);

    /**
     * gets the currently applicable health coach messages
     * @param user the user of the current request
     * @param uistate the uistate he is in
     * @param cb a callback with parameters (err, coachMessageIds, facts) where facts are the calculated facts about
     * the current user that were used to evaluate the rules. Can be used to debug, why certain rules matched or not.
     *
     */
    this.getCurrentMessages = function (user, uistate, cb) {
        var facts = new Facts(user, uistate);

        facts.init(function (err) {
            if (err) {
                return cb(err);
            }
            var result = re.evaluate(facts);
            return cb(null, result, facts);
        });
    };
}


module.exports = HealthCoach;