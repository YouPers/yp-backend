var eventsSummaryMail = require('./batches/eventsSummaryMail'),
    config = require('./config/config'),
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
        name: 'DailyEventSummary',
        description: 'sends a daily email to users who had events with end dates in the specified time range',
        cronTime: '00 15 05 * * *',
        onTick: eventsSummaryMail.run,
        start: true,
        context: {
            timeFrameToFindEvents: 24 * 60 * 60 * 1000,
            concurrency: 2
        }
    }
];

/**
 * launches all jobs defined in the jobs-array above.
 */
scheduler.scheduleJobs(jobs, logger);

