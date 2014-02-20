var env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env],
    cronJob = require('cron').CronJob,
    _ = require('lodash'),
    Logger = require('bunyan'),
    log =  new Logger(config.loggerOptions),
    eventsSummaryMail = require('./batches/eventsSummaryMail');



var jobs = [
    {
        name: 'myTestJob',
        cronTime: '* * * * * *',
        onTick: eventsSummaryMail.run,
        start: false,
        context: {
            log: log,
            timeFrameToFindEvents: 24 * 60 * 60 * 1000
        }
    }
];


_.forEach(jobs, function scheduleJob( job) {
    log.info('scheduling Job: "'+ job.name + '" with schedule: "'+ job.cronTime + '"');
    new cronJob(job).start();
});

