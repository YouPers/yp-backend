var async = require('async'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment');


var commonFacts = [
    {
        name: 'assessmentResult',
        description: 'provides information about the state of the self assessment for a user:' +
            'done: (Boolean) whether he has filled out the assessment' +
            'completion (float: 0..1)the completion state of the assessment' +
            'age: (int) the seconds since the user last updated the assessment',
        calc: function (userId, cb) {
            mongoose.getModel('AssessmentResult').aggregate([
                    {$match: {owner: userId}},
                    {$sort: {timestamp: -1}},
                    {$limit: 1}
                ],
                function (err, result) {

                    var Fact = function (done, completion, age) {
                        this.done = done;
                        this.completion = completion;
                        this.age = age;
                    };


                    if (err) {
                        return cb(err);
                    }

                    if (!result) {

                        return cb(null, new Fact(false));
                    }

                    var fact = new Fact(true, result.completion, new Date() - result.timestamp);
                    return cb(null, fact);
                });
        }
    },
    {
        name: 'activities',
        description: 'provides information about how many activities a user has planned, done, missed' +
            'total: {planned: # of planned activities, missed: # of missed events, done: # of done events, open: # of not reported on events},' +
            'last7days: {planned: # of planned activities, missed: # of missed events, done: # of done events, open: # of not reported on events},' +
            'next7days: {planned: # of planned activities, missed: # of missed events, done: # of done events, open: # of not reported on events}',
        calc: function (userId, cb) {
            mongoose.getModel('ActivityPlan').find({owner: userId}).exec(
                function (err, plans) {
                    if (err) {
                        return cb(err);
                    }
                    var Fact = function (total, next7Days, last7Days) {
                        this.total = total || {plannedAct: 0, future: 0, missed: 0, done: 0, open: 0};
                        this.next7Days = next7Days || {future: 0};
                        this.last7Days = last7Days || {missed: 0, done: 0, open: 0};
                    };

                    var fact = new Fact();
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
                                    fact.next7Days.future++;
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
        }
    },
    {
        name: 'goals',
        description: 'number of set goals in the current challenge',
        calc: function (userId, cb) {

        }
    }
];


function Facts(user) {
    var self = this;
    self.user = user;


    self.load = function (cb) {
        if (!this.user) {
            // calculate facts for anonymous user

        } else {

            // get the commonly used facts for this user
            async.forEachLimit(commonFacts, 5, function (commonFact, done) {
                commonFact.calc(user._id, function (err, fact) {
                    if (err) {
                        return done(err);
                    }
                    self[commonFact.name] = fact;
                    return done();
                });
            }, function (err) {
                if (err) {
                    return cb(err, self);
                }


            });
        }

    };
}


var getCoachMessagesFn = function getCoachMessagesFn(req, res, next) {

    // determine current facts for current user

    var facts = new Facts(req.user);

    facts.load(function(err) {

        // evaluate rules for these facts

        // return messages





    });

};


module.exports = {
    getCoachMessagesFn: getCoachMessagesFn
}