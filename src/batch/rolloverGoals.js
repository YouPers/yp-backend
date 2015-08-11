var mongoose = require('ypbackendlib').mongoose,
    batch = require('ypbackendlib').batch,
    config = require('../config/config');

var feeder = function (callback) {
    var log = this.log;
    log.debug("Finding all goals that need to be rolled over");
    mongoose.model('Goal').find(
       // TODO: query {}
    ).exec(callback);
};

var worker = function (goal, done) {
    var log = this.log;
    log.debug({goal: goal}, "goal to rollover found");
    // finalize this goal
    // TODO: goal.....
    goal.save(done);

    //
    // TODO: create another goal


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