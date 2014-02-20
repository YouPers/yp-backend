var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log =  new Logger(config.loggerOptions),
    mongoose = require('mongoose'),
    moment = require('moment'),
    db = require('../util/database'),
    async = require('async'),
    email = require('../util/email'),
    i18n = require('../util/ypi18n').initialize();


var sendSummaryMail = function sendSummaryMail(user, rangeStart, rangeEnd, done) {

    if (user._id) {
        user = user._id;
    }
    user = user instanceof mongoose.Types.ObjectId ? user : new mongoose.Types.ObjectId(user);

    log.info('preparing Summary Mail for user: ' + user);

    mongoose.model('ActivityPlan').aggregate()
        .append({$match: {owner: user._id || user, events: {$elemMatch: {end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}
        }}})
        .append({$unwind: '$events'})
        .append({$match: {'events.end': {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}})
        .exec(function (err, events) {
            if (err) {
                log.error(err);
                return done(err);
            }
            log.debug({events: events}, 'found events for user: ' + user);

            mongoose.model('User')
                .findById(user)
                .select('+email +profile')
                .populate('profile')
                .exec(function (err, user) {
                    if (err) {
                        log.error({error: err}, 'error loading user');
                        return done(err);
                    }
                    if (!user) {
                        log.error({error: err}, 'User not found');
                        return done(err);
                    }

                    i18n.setLng(user.profile.language || 'de', function () {
                        log.info('sending DailySummary Mail to email: ' + user.email + ' with ' + events.length + ' events.');
                        email.sendDailyEventSummary(user.email, events, user, i18n);
                        return done();
                    });
                });

        });

};


var run = function run() {

    db.initialize(false);

    var timeFrame = this.timeFrameToFindEvents || 24 * 60 * 60 * 1000;

    var rangeEnd = moment();
    var rangeStart = moment(rangeEnd).subtract('milliseconds', timeFrame);

    log.info("Finding all users who had scheduled events ending between: " + rangeStart.format() + " and " + rangeEnd.format());

    var ActivityPlanModel = mongoose.model('ActivityPlan');

    var aggregate = ActivityPlanModel.aggregate();
    aggregate
        .append({$match: {events: {$elemMatch: {end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}
        }
        }
        }
        })
        .append({$group: {_id: '$owner'}})
        .exec(function (err, owners) {
            if (err) {
                log.error({error: err}, "error");
            }
            log.debug({owner: owners}, "found these owners");

            async.forEachLimit(owners, 5, function (owner, done) {
                return sendSummaryMail(owner, rangeStart, rangeEnd, done);
            }, function (err) {
                if (err) {
                    log.error('error while sending emails');
                }
                mongoose.connection.close();
            });


        });
};


module.exports = {
    run: run,
    sendSummaryMail: sendSummaryMail

};