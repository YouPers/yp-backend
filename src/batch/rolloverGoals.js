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
    var newStart = moment().add(1, 'week').startOf('week').toDate();
    var newEnd = moment().add(1, 'week').endOf('week').toDate();
    var oldEnd = goal.end;
    log.debug({goal: goal, newStart: newStart, newEnd: newEnd, oldEnd: oldEnd}, "goal to rollover found, ");
    // finalize this goal
    goal.end = moment().endOf('week').toDate();
    goal.save();
    var Goal = mongoose.model('Goal');
    var newGoal = new Goal({
            owner: goal.owner,
            title: goal.title,
            categories: goal.categories,
            timesCount: goal.timesCount,
            timeFrame: goal.timeFrame,
            start: newStart,
            end: newEnd
        });
    newGoal.save(function(err, savedGoal) {
        return done(err, {msg: "rolled over goal", id: savedGoal.id, oldStart: goal.start, newStart: savedGoal.start, oldEnd: oldEnd, newEnd: savedGoal.end});
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