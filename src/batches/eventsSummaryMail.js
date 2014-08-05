var mongoose = require('mongoose'),
    moment = require('moment'),
    email = require('../util/email'),
    batch = require('./batch');

/**
 * worker function that sends a DailySummaryMail for one specific user.
 * @param user an object with a "_id" property containing the id of the user for which to send an email.
 *             can be a full user object or just an object with this "_id" property.
 * @param rangeStart
 * @param rangeEnd
 * @param done
 * @param context
 */
var sendSummaryMail = function sendSummaryMail(user, rangeStart, rangeEnd, done, context) {
    var log = (context && context.log) || this.log;
    var i18n = (context && context.i18n) || this.i18n;

    if (!log || !i18n) {
        throw new Error('missing log and i18n: must be present either in "this" or in the passed context object');
    }
    if (user._id) {
        user = user._id;
    }
    user = user instanceof mongoose.Types.ObjectId ? user : new mongoose.Types.ObjectId(user);

    log.info('preparing Summary Mail for user: ' + user);

    // Query explanation
    // - Find all Events for this user in our daterange
    mongoose.model('ActivityEvent').aggregate()
        .append({$match: {owner: user._id || user, end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()
        }}})
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

                    if (!user.profile.prefs.email.dailyUserMail) {
                        log.info('sendSummaryMail: User(' + user.username + ':' + user.id + ').profile.prefs.email.dailyUserMail=false');
                        return done();
                    }

                    i18n.setLng(user.profile.language || 'de', function () {
                        log.info('sending DailySummary Mail to email: ' + user.email + ' with ' + events.length + ' events.');

                        email.sendDailyEventSummary.apply(this, [user.email, events, user, i18n]);
                        return done();
                    });
                });

        });

};

var feeder = function (callback) {
    var log = this.log;
    var timeFrame = this.timeFrameToFindEvents || 24 * 60 * 60 * 1000;

    var rangeEnd = moment();
    var rangeStart = moment(rangeEnd).subtract(timeFrame, 'milliseconds');
    this.rangeStart = rangeStart;
    this.rangeEnd = rangeEnd;

    log.info("Finding all users who had scheduled events ending between: " + rangeStart.format() + " and " + rangeEnd.format());

    var ActivityModel = mongoose.model('Activity');

    // Query documentation:
    // find all users that have at least one event that has its end-date in the rage we are interested in
    // group by user and return an array of objects in the form: [{_id: "qwer32r32r23r"}, {_id: "2342wefwefewf"}, ...]
    var aggregate = ActivityModel.aggregate();
    aggregate
        .append({
            $match: {
                // TODO: match 'owner.profile.prefs.email.dailyUserMail': true,
                events: {
                    $elemMatch: {end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}
                }
            }
        })
        .append({$group: {_id: '$owner'}})
        .exec(callback);
};

var worker = function (owner, done) {
    return sendSummaryMail.apply(this, [owner, this.rangeStart, this.rangeEnd, done]);
};

var run = function run() {
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    sendSummaryMail: sendSummaryMail
};