var env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env],
    cronJob = require('cron').CronJob,
    _ = require('lodash'),
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    eventsSummaryMail = require('./batches/eventsSummaryMail');

/////////////////////////////////////////
//CRON Syntax to be used to schedule a task
//
// * * * * *
// ┬ ┬ ┬ ┬ ┬
// │ │ │ │ │
// │ │ │ │ │
// │ │ │ │ └───── day of week (0 - 7) (0 to 6 are Sunday to Saturday, or use names; 7 is Sunday, the same as 0)
// │ │ │ └────────── month (1 - 12)
// │ │ └─────────────── day of month (1 - 31)
// │ └──────────────────── hour (0 - 23)
// └───────────────────────── min (0 - 59)
//
// for more complex scheduling see syntax here: http://en.wikipedia.org/wiki/Cron
//
var jobs = [
    {
        name: 'DailyEventSummary',
        description: 'sends a daily email to users who had events with end dates in the specified time range',
        cronTime: '*/5 * * * * *',
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
_.forEach(jobs, function scheduleJob(job) {
    job.context.name = job.name;
    job.context.description = job.description;
    job.context.cronTime = job.cronTime;
    log.info('scheduling Job: "' + job.name + '" with schedule: "' + job.cronTime + '"');
    new cronJob(job).start();
});

