var log = require('../util/log').logger,
    mongoose = require('mongoose'),
    db = require('../util/database'),
    async = require('async'),
    i18n = require('../util/ypi18n').initialize(),
    _ = require('lodash'),
    shortid = require('shortid');

/**
 * Generic Batch skeleton that should be used to implement any scheduled batch task that can be expressed with
 * the feeder/worker pattern.
 *
 * Implememtation notes:
 * This implementation uses node.async.forEachLimit to process all workItems the feeder returns. The maximal concurrency
 * can be controlled by the 'concurrency' attribute to be configured in the batch scheduler.
 *
 * It can be used
 * in cases:
 * - where the feeder runs reasonably fast so we can wait until it returns all workItems before starting
 * to process the workitems,
 * - where we have no need to use multiple node processes (this means, jobs that do IO (e.g. some DB-calls and than sending an
 * email are perfectly fine, BUT jobs with heavy CPU processing will need another solution.
 *
 * @param feeder(callback(err, workItems), args...) the feeder function that finds all work items to be processed. Gets a callback it
 * needs to call at the end. Feeder is run in the Batch-Context, e.g. it can get 'this.log', 'this.i18n', 'this.name' or 'this.batchId'
 * @param worker(workItem, callback(err)) the worker function that processes one specific work item. Gets a callback it
 * needs to call at the end. Worker is run in the Batch-Context, e.g. it can get 'this.log', 'this.i18n', 'this.name' or 'this.batchId'
 * @param context The context where the feeder and worker are supposed to run in, usually passed from the scheduler job context.
 * @param additional optional arguments: are passed on to the feeder and the worker function after their respective
 * required arguments.
 */
var genericBatch = function genericBatch(feeder, worker, context) {
    context = context || this;
    db.initialize(false);
    context.batchId = shortid.generate();
    log = context.log = log.child({batchId: context.name + ':' + context.batchId});

    context.i18n = i18n;

    log.info('Batch Job: ' + context.name + ":" + context.batchId + ": STARTING");
    var concurrency = context.concurrency || 5;

    var processFn = function (err, work) {
        if (err) {
            log.error({err: err}, "Error in Batch-Feeder, ABORTING");
            mongoose.connection.close();
        } else {
            log.info("Found " + work.length + " work items. Starting parallel processing with concurrency: " + concurrency);

            async.forEachLimit(work, concurrency, function (workItem, done) {
                log.info({item: workItem}, 'Processing WorkItem');
                var myArgs = _.clone(args);
                myArgs.unshift(workItem, done);
                return worker.apply(context, myArgs);
            }, function (err) {
                if (err) {
                    log.error({err: err}, 'Batch Job: ' + context.name + ":" + context.batchId + " : error while completing the workItems");
                }
                mongoose.connection.close();
            });
        }
    };

    // passing on the additional arguments we were called with to the feeder function, we remove the first three
    // and add the rest

    var args = [processFn];
    for (var i = 3; i > arguments.length; i++) {
        args.push(arguments[i]);
    }

    feeder.apply(context, args);
};

module.exports = {
    genericBatch: genericBatch
};