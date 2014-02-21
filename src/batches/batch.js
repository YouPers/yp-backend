var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    mongoose = require('mongoose'),
    db = require('../util/database'),
    async = require('async'),
    i18n = require('../util/ypi18n').initialize(),
    _ = require('lodash'),
    shortid = require('shortid');


var genericBatch = function genericBatch(feeder, worker, context) {
    db.initialize(false);
    context.batchId = shortid.generate();
    log = context.log = log.child({batchId: context.name + ':' + context.batchId});

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

    var args = [processFn];
    for (var i = 3; i > arguments.length; i++) {
        args.push(arguments[i]);
    }
    context.i18n = i18n;

    feeder.apply(context, args);
};

module.exports = {
    genericBatch: genericBatch
};