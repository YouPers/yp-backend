var config = require('./config/config'),
    scheduler = require('ypbackendlib').scheduler,
    logger = require('ypbackendlib').log(config);

/////////////////////////////////////////
//CRON Syntax to be used to schedule a task
//
// s m h d m w
// ┬ ┬ ┬ ┬ ┬ ┬
// │ │ │ │ │ │
// │ │ │ │ │ │
// │ │ │ │ │ └───── day of week (0 - 7) (0 to 6 are Sunday to Saturday, or use names; 7 is Sunday, the same as 0)
// │ │ │ │ └────────── month (1 - 12)
// │ │ │ └───────────── day of month (1 - 31)
// │ │ └─────────────── hour (0 - 23)
// │ └──────────────────── min (0 - 59)
// └───────────────────────── sec (0-59)
//
//
// for more complex scheduling see syntax here: http://en.wikipedia.org/wiki/Cron
//
var jobs = [
    {
        name: 'RolloverGoals',
        description: 'rolls over all goals with an end date in the future to the next week, su night',
        cronTime: '00 00 21 * * 0',
        onTick: require('./batch/rolloverGoals').run,
        start: true,
        context: {
            concurrency: 1
        }
    }
];

/**
 * launches all jobs defined in the jobs-array above.
 */
scheduler.scheduleJobs(jobs, logger);

