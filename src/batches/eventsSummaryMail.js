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
    // - Find all activityPlans for this user that have at least one event in our daterange
    // - $unwind the events array into the result rows, now we have a row for each event of each plan we found.
    //   In the events-property of these plans there is now exactly one event!.
    // - select all plansEvents whose one event is in our daterange
    // - As a result we expect an array of ActivityPlans that have in their respective events-property one specific event
    //   instead of an array (due to the $unwind above)
    mongoose.model('ActivityPlan').aggregate()
        .append({$match: {owner: user._id || user, events: {$elemMatch: {end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}
        }}})
        .append({$unwind: '$events'})
        .append({$match: {'events.end': {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}})
        .exec(function (err, plans) {
            if (err) {
                log.error(err);
                return done(err);
            }
            log.debug({events: plans}, 'found events for user: ' + user);

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

                    if(!user.profile.userPreferences.email.dailyUserMail) {
                        log.info('sendSummaryMail: User('+user.username+':'+user.id+').profile.userPreferences.email.dailyUserMail=false');
                        return done();
                    }

                    i18n.setLng(user.profile.language || 'de', function () {
                        log.info('sending DailySummary Mail to email: ' + user.email + ' with ' + plans.length + ' events.');

                        ///////////////////////////////////////////////
                        // TODO: WL-722 sending the summary emails to YOUPERS to get some information about the campaign
                        // we replace the user's email temporary with the youpers.operator
                        // need to reenable after the Kt. Luzern Test-Campaign
                        //
                        // correct Line:
                        // email.sendDailyEventSummary.apply(this, [user.email, plans, user, i18n]);
                        //
                        // temporary disabling:
                        email.sendDailyEventSummary.apply(this, ['youpers.operator@gmail.com', plans, user, i18n]);

                        return done();
                    });
                });

        });

};

var feeder = function (callback) {
    var log = this.log;
    var timeFrame = this.timeFrameToFindEvents || 24 * 60 * 60 * 1000;

    var rangeEnd = moment();
    var rangeStart = moment(rangeEnd).subtract('milliseconds', timeFrame);
    this.rangeStart = rangeStart;
    this.rangeEnd = rangeEnd;

    log.info("Finding all users who had scheduled events ending between: " + rangeStart.format() + " and " + rangeEnd.format());

    var ActivityPlanModel = mongoose.model('ActivityPlan');

    // Query documentation:
    // find all users that have at least one event that has its end-date in the rage we are interested in
    // group by user and return an array of objects in the form: [{_id: "qwer32r32r23r"}, {_id: "2342wefwefewf"}, ...]
    var aggregate = ActivityPlanModel.aggregate();
    aggregate
        .append({
            $match: {
                // TODO: match 'owner.profile.userPreferences.email.dailyUserMail': true,
                events: {
                    $elemMatch: {end: {$gt: rangeStart.toDate(), $lt: rangeEnd.toDate()}}
                }
            }
        })
        .append({$group: {_id: '$owner'}})
        .exec(callback);
};

var worker = function (owner, done) {
    return sendSummaryMail.apply(this, [owner,this.rangeStart, this.rangeEnd,  done]);
};

var run = function run() {
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    sendSummaryMail: sendSummaryMail
};