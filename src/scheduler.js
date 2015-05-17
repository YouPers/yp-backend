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
        name: 'DailyEventSummary',
        description: 'sends a daily email to users who had events with end dates in the specified time range',
        cronTime: '00 15 05 * * *',
        onTick: require('./batches/dailySummaryMail').run,
        start: true,
        context: {
            concurrency: 2
        }
    },
    {
        name: 'WeeklyCampaignLeadSummary',
        description: 'sends a weekly email to campaign leads',
        cronTime: '00 15 10 * * *', // equals daily 12:15 in UTC+2 (CET with daylight saving time)
        onTick: require('./batches/campaignLeadSummaryMail').run,
        start: true,
        context: {
            concurrency: 2
        }
    },
    {
        name: 'BrokenLinkCheckerDB',
        description: 'checks for and reports broken links in the db content and the WTI translations',
        cronTime: '00 00 10 * * *',
        onTick: require('./batches/brokenLinkCheckerDB').run,
        start: true,
        environments: ['hc-content'],
        context: {
            concurrency: 5
        }
    },
    {
        name: 'BrokenLinkCheckerWTI',
        description: 'checks for and reports broken links in the db content and the WTI translations',
        cronTime: '00 00 10 * * *',
        onTick: require('./batches/brokenLinkCheckerWTI').run,
        start: true,
        environments: ['hc-content'],
        context: {
            concurrency: 5
        }
    }
];

/**
 * launches all jobs defined in the jobs-array above.
 */
scheduler.scheduleJobs(jobs, logger, config);

