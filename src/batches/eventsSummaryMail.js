var mongoose = require('ypbackendlib').mongoose,
    moment = require('moment'),
    _ = require('lodash'),
    async = require('async'),
    email = require('../util/email'),
    batch = require('ypbackendlib').batch;



/*
 *  gather locals for daily summary mail
 */
var getSummaryMailLocals = function getSummaryMailLocals(user, rangeStart, rangeEnd, callback) {

    var locals = {
        user: user.toJSON()
    };

    var storeLocals = function (localKey, done) {
        return function (err, result) {
            if(err) { return err; }
            locals[localKey] = result;
            done(err, result);
        };
    };

    var now = moment();
    var startOfDay = moment().startOf('day');
    var endOfDay = moment().endOf('day');

    var dismissedSocialInteractions = [];

    var tasks = [

        // eventsToday
        function (done) {
            mongoose.model('ActivityEvent').find({
                owner: user._id || user,
                start: { $gt: startOfDay, $lt: endOfDay }
            }).populate('activity').exec(storeLocals('eventsToday', done));
        },

        // eventsWithOpenFeedback
        function (done) {
            mongoose.model('ActivityEvent').find({
                owner: user._id || user,
                status: 'open',
                end: { $lt: moment() }
            }).populate('activity').exec(storeLocals('eventsWithOpenFeedback', done));
        },

        // newCampaignMessages
        function (done) {
            mongoose.model('Message').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: now }
            }).populate('author').exec(storeLocals('newCampaignMessages', done));
        },

        // newCampaignActivityInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: now }
            }).populate('author activity').exec(storeLocals('newCampaignActivityInvitations', done));
        },

        // newCampaignRecommendations
        function (done) {
            mongoose.model('Recommendation').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: now }
            }).populate('author idea').exec(storeLocals('newCampaignRecommendations', done));
        },

        // newPersonalInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'user',
                targetSpaces: { $elemMatch: { targetId: user.id }},
                created: { $gt: rangeStart }
            }).populate('author activity').exec(storeLocals('newPersonalInvitations', done));
        },

        // newCommentsOnParticipatedActivities
        function (done) {
            mongoose.model('Activity').find({
                $or: [
                    { owner: user },
                    { joiningUsers: user }
                ]
            }, { _id: 1 }).exec(function (err, activities) {
                var activityIds = _.map(activities, '_id');

                mongoose.model('Message').find({
                    _id: { $nin: dismissedSocialInteractions },
                    authorType: 'user',
                    targetSpaces: { $elemMatch: { targetId: {
                        $in: activityIds
                    } }},
                    created: { $gt: rangeStart }
                }).populate('author').exec(storeLocals('newCommentsOnParticipatedActivities', done));
            });
        }
    ];

    mongoose.model('SocialInteractionDismissed').find({user: user}, {socialInteraction: 1}).exec(function (err, sids) {
        dismissedSocialInteractions = _.map(sids, 'socialInteraction');

        async.parallel(tasks, function (err) {
            if(err) {
                return callback(err);
            }
            callback(err, locals);
        });
    });


};

var renderSummaryMail = function (user, rangeStart, rangeEnd, i18n, callback) {


    getSummaryMailLocals(user, rangeStart, rangeEnd, function (err, locals) {
        if(err) {
            return callback(err);
        }
        var mailLocals = email.getDailyEventSummaryLocals(locals, i18n);
        email.renderEmailTemplate('dailyEventsSummary', mailLocals, callback);
    });
};

/**
 * worker function that sends a DailySummaryMail for one specific user.
 * @param user an object with a "_id" property containing the id of the user for which to send an email.
 *             can be a full user object or just an object with this "_id" property.
 * @param now
 * @param done
 * @param context
 */
var sendSummaryMail = function sendSummaryMail(user, now, done, context) {
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

    mongoose.model('User')
        .findById(user)
        .select('+email +profile +campaign')
        .populate('profile campaign')
        .exec(function (err, user) {
            if (err) {
                log.error({error: err}, 'error loading user');
                return done(err);
            }
            if (!user) {
                log.error({error: err}, 'User not found');
                return done(err);
            }

            var rangeStart = moment(user.lastSummaryMail) || moment(user.campaign.start);
            var rangeEnd = moment(now);

            getSummaryMailLocals(user, rangeStart.toDate(), rangeEnd.toDate(), function (err, locals) {

                i18n.setLng(user.profile.language || 'de', function () {
                    log.info('sending DailySummary Mail to email: ' + user.email);

                    email.sendDailyEventSummary.apply(this, [user.email, locals, user, i18n]);
                    return done();
                });
            });
        });
};

var feeder = function (callback) {
    var log = this.log;
    var now = moment();
    this.now = now;

    log.info("Finding all users (excl. roles [campaignlead, productadmin], with dailyUserMail=true, and a currently active campaign today: " + now);

    mongoose.model('Campaign').find({
        start: { $lt: now.toDate() },
        end: { $gt: now.toDate() }
    }, { _id: 1 }).exec(function (err, campaigns) {
        if(err) {
            return callback(err);
        }
        mongoose.model('User').find({
            campaign: { $in: _.map(campaigns, '_id') },
            roles: { $nin: ['campaignlead', 'productadmin'] },
            profile: { prefs: { email: { dailyUserMail: 1} } }
        }).select('+roles +profile').populate('profile').exec(callback);
    });

};

var worker = function (owner, done) {
    return sendSummaryMail.apply(this, [owner, this.now, done]);
};

var run = function run() {
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    sendSummaryMail: sendSummaryMail,
    renderSummaryMail: renderSummaryMail
};