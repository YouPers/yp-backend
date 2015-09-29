var mongoose = require('ypbackendlib').mongoose,
    batch = require('ypbackendlib').batch,
    config = require('../config/config'),
    moment = require('moment');

var feeder = function (callback) {
    var log = this.log;
    log.debug("Finding all currently running goals that need to be rolled over");
    var now = new Date();
    mongoose.model('Goal').find(
        {
            $and: [{end: {$gt: now}}, {end: {$gt: moment().endOf('week').toDate()}}, {start: {$lt: now}}]
        }
    ).exec(callback);
};

var worker = function (goal, done) {
    var log = this.log;

    var terminatedGoalStart = goal.start;
    var terminatedGoalEndBefore = goal.end;
    var terminatedGoalEndAfter = moment().isoWeekday(7).endOf('day').toDate();

    log.debug({
        goal: goal,
        terminatedGoalStart: terminatedGoalStart,
        terminatedGoalEndBefore: terminatedGoalEndBefore,
        terminatedGoalEndAfter: terminatedGoalEndAfter
    }, "goal to rollover found.");

    // finalize this goal
    goal.end = terminatedGoalEndAfter;
    goal.save();

    // create a new Goal, start = beginning of next week, end = end of Time
    var Goal = mongoose.model('Goal');

    var newGoal = new Goal({
            owner: goal.owner,
            title: goal.title,
            categories: goal.categories,
            timesCount: goal.timesCount,
            timeFrame: goal.timeFrame,
            start: moment().add(1, 'week').isoWeekday(1).toDate(),
            end: moment("9999-12-31").toDate()
        });

    newGoal.save(function(err, savedNewGoal) {
        return done(err, {msg: "rolled over goal",
            id: savedNewGoal.id,
            cats: savedNewGoal.categories,
            terminatedGoalStart: terminatedGoalStart,
            terminatedGoalEndBefore: terminatedGoalEndBefore,
            terminatedGoalEndAfter: terminatedGoalEndAfter,
            newGoalStart: savedNewGoal.start,
            newGoalEnd: savedNewGoal.end});
    });
};

var run = function run() {
    require('../util/database').initializeDb();
    this.config = config;
    this.log = require('ypbackendlib').log(config);
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run
};