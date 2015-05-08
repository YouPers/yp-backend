var mongoose = require('ypbackendlib').mongoose,
    moment = require('moment-timezone'),
    _ = require('lodash'),
    async = require('async'),
    email = require('../util/email'),
    batch = require('ypbackendlib').batch,
    config = require('../config/config');

var mailType = 'dailySummaryMail';


/*
 *  gather locals for daily summary mail
 */
var getMailLocals = function getMailLocals(user, lastSentMailDate, currentDate, callback) {

    var locals = {
        user: user.toJSON(),
        lastSentMailDate: lastSentMailDate,
        currentDate: currentDate,
        campaignOffers: []
    };

    var storeLocals = function (localKey, done) {
        return function (err, result) {
            if (err) {
                return err;
            }
            locals[localKey] = result.toJSON ? result.toJSON() : result;
            if (_.isArray(result)) {
                locals[localKey + 'Count'] = result.length;
                for (var i = 0; i < result.length; i++) {
                    result[i] = result[i].toJSON ? result[i].toJSON() : result[i];
                }
            }
            done(err, result);
        };
    };

    // TODO: use proper timezone of the user here
    var startOfDay = moment(currentDate).tz('Europe/Zurich').startOf('day').toDate();
    var endOfDay = moment(currentDate).tz('Europe/Zurich').endOf('day').toDate();

    var dismissedSocialInteractions = [];

    var tasks = [

        // section 1


        // campaignParticipants
        function (done) {
            mongoose.model('User').count({
                campaign: user.campaign
            }).exec(storeLocals('campaignParticipants', done));
        },

        // section 2

        // eventsToday
        function (done) {
            mongoose.model('ActivityEvent').find({
                owner: user._id || user,
                campaign: user.campaign,
                start: {$gt: startOfDay, $lt: endOfDay}
            }).sort({start: 1}).populate('activity').populate('idea').exec(storeLocals('eventsToday', done));
        },

        // eventsWithOpenFeedback
        function (done) {
            mongoose.model('ActivityEvent').find({
                owner: user._id || user,
                campaign: user.campaign,
                status: 'open',
                end: {$lt: moment()}
            }).sort({start: 1}).populate('activity').populate('idea').exec(storeLocals('eventsWithOpenFeedback', done));
        },

        // section 3

        // newCampaignMessages
        function (done) {
            mongoose.model('Message').find({
                _id: {$nin: dismissedSocialInteractions},
                authorType: 'campaignLead',
                targetSpaces: {$elemMatch: {targetId: user.campaign}},
                publishFrom: {$gte: lastSentMailDate, $lte: currentDate},
                publishTo: {$gte: currentDate}
            }).sort({publishFrom: 1}).populate('author').exec(storeLocals('newCampaignMessages', done));
        },

        // newCampaignActivityInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: {$nin: dismissedSocialInteractions},
                authorType: 'campaignLead',
                activity: {$nin: locals.activities},
                targetSpaces: {$elemMatch: {targetId: user.campaign}},
                publishFrom: {$gte: lastSentMailDate, $lte: currentDate},
                publishTo: {$gte: currentDate}
            }).sort({publishFrom: 1}).populate('author activity idea').exec(storeLocals('newCampaignActivityInvitations', done));
        },

        // newRecommendations
        function (done) {
            mongoose.model('Recommendation').find({
                _id: {$nin: dismissedSocialInteractions},
                targetSpaces: {$elemMatch: {targetId: user.campaign}},
                publishFrom: {$gte: lastSentMailDate, $lte: currentDate},
                publishTo: {$gte: currentDate}
            }).sort({publishFrom: 1}).populate('author idea').exec(storeLocals('newRecommendations', done));
        },

        // newPersonalInvitations
        function (done) {
            mongoose.model('Activity').find({campaign: user.campaign}, {_id: 1}).exec(function (err, activities) {
                var activityIds = _.map(activities, '_id');
                mongoose.model('Invitation').find({
                    _id: {$nin: dismissedSocialInteractions},
                    activity: {$in: activityIds},
                    authorType: 'user',
                    targetSpaces: {$elemMatch: {targetId: user.id}},
                    publishFrom: {$gte: lastSentMailDate, $lte: currentDate},
                    publishTo: {$gte: currentDate}
                }).sort({publishFrom: 1}).populate('author activity idea').exec(storeLocals('newPersonalInvitations', done));
            });

        },

        // newCommentsOnParticipatedActivities
        function (done) {
            mongoose.model('Activity').find({
                campaign: user.campaign,
                $or: [
                    {owner: user},
                    {joiningUsers: user}
                ]
            }, {_id: 1}).exec(function (err, activities) {
                var activityIds = _.map(activities, '_id');

                mongoose.model('Message').count({
                    _id: {$nin: dismissedSocialInteractions},
                    author: {$ne: user},
                    authorType: 'user',
                    targetSpaces: {
                        $elemMatch: {
                            targetId: {
                                $in: activityIds
                            }
                        }
                    },
                    created: {$gte: lastSentMailDate}
                }).exec(storeLocals('newCommentsOnParticipatedActivities', done));
            });
        },

        // newPublicInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: {$nin: dismissedSocialInteractions},
                activity: {$nin: locals.activities},
                authorType: 'user',
                targetSpaces: {$elemMatch: {targetId: user.campaign}},
                created: {$gte: lastSentMailDate}
            }).sort({created: 1}).populate('author activity idea').exec(storeLocals('newPublicInvitations', done));
        }
    ];

    mongoose.model('SocialInteractionDismissed').find({user: user}, {socialInteraction: 1}).exec(function (err, sids) {
        dismissedSocialInteractions = _.map(sids, 'socialInteraction');

        mongoose.model('Activity').find({
            campaign: user.campaign,
            $or: [
                {owner: user._id},
                {joiningUsers: user._id}
            ]
        }).select('_id').exec(function (err, ids) {

            locals.activities = _.map(ids, '_id');
            locals.personalActivities = ids.length;

            async.parallel(tasks, function (err) {
                if (err) {
                    return callback(err);
                }

                locals.campaignOffers = [].concat(
                    locals.newCampaignActivityInvitations,
                    locals.newPersonalInvitations,
                    locals.newPublicInvitations,
                    locals.newRecommendations
                );
                callback(err, locals);
            });
        });
    });


};

var renderMail = function (user, lastSentMailDate, currentDate, req, callback) {

    getMailLocals(user, lastSentMailDate, currentDate, function (err, locals) {
        if (err) {
            return callback(err);
        }

        var mailLocals = email.getStandardMailLocals(mailType, locals, req.i18n);
        req.log.debug(mailLocals, "using these Locals for dailySummary");
        email.renderEmailTemplate(mailType, mailLocals, callback);
    });
};

/**
 * worker function that sends a DailySummaryMail for one specific user.
 * @param user full user object, with populated profile and campaing
 * @param lastSentMailDate
 * @param currentDate
 * @param done
 * @param context
 */
var sendMail = function sendMail(user, lastSentMailDate, currentDate, done, context) {
    var log = (context && context.log) || this.log;
    var i18n = (context && context.i18n) || this.i18n;
    if (!user || !user.profile || !user.profile._id || !user.campaign || !user.campaign._id || !user.email) {
        throw new Error('batch worker need a user with populated profile and campaign');
    }
    if (!log || !i18n) {
        throw new Error('missing log and i18n: must be present either in "this" or in the passed context object');
    }
    log.info('preparing Summary Mail for user: ' + user.email);

    // if no lastSentMailDate is provided, use the date the last mail was sent stored at the user, or the start of the campaign
    if (!lastSentMailDate) {
        var lastDate = user.lastSummaryMail || user.campaign.start;
        lastSentMailDate = moment(lastDate);
    }
    currentDate = currentDate ? moment(currentDate) : moment();

    // check if dailyUserMail is enabled in the user's profile
    if (!user.profile.prefs.email.dailyUserMail) {
        log.debug('DailySummary not sent, disabled in profile: ' + user.email);
        return done(null, 'DailySummary not sent, disabled in profile');
    }

    // check defaultWorkWeek in the user's profile
    var weekDay = currentDate.format('dd').toUpperCase(); // MO, TU, WE, ..
    var defaultWorkWeek = user.profile.prefs.defaultWorkWeek || ['MO', 'TU', 'WE', 'TH', 'FR'];
    if (!_.contains(defaultWorkWeek, weekDay)) {
        log.debug('DailySummary not sent, defaultWorkWeek from the user does not contain today: ' + weekDay + ', defaultWorkWeek: ' + user.profile.prefs.defaultWorkWeek + ', email: ' + user.email);
        return done(null, 'DailySummary not sent, defaultWorkWeek from the user does not contain today: ' + weekDay + ', defaultWorkWeek: ' + user.profile.prefs.defaultWorkWeek);
    }


    getMailLocals(user, lastSentMailDate.toDate(), currentDate.toDate(), function (err, locals) {

        i18n.setLng(user.profile.language || 'de');

        log.info('sending DailySummary Mail to email: ' + user.email);

        email.sendStandardMail.apply(this, [mailType, user.email, locals, user, i18n, function (err, result) {

            if (err) {
                return done(err);
            }

            mongoose.model('User').update({_id: user._id},
                {
                    $set: {
                        lastSummaryMail: currentDate.toDate()
                    }
                }, function (err) {
                    if (err) {
                        return done(err);
                    }
                    return done(null, 'Mail sent to: ' + user.email);
                });

        }]);

    });

};

var feeder = function (callback) {
    var log = this.log;
    var now = moment();

    log.debug("Finding all users (excl. roles [productadmin], with dailyUserMail=true, and a currently active campaign today: " + now);

    mongoose.model('Campaign').find({
        start: {$lt: now.toDate()},
        end: {$gt: now.toDate()}
    }, {_id: 1}).exec(function (err, campaigns) {
        if (err) {
            return callback(err);
        }
        mongoose.model('User').find({
            campaign: {$in: _.map(campaigns, '_id')},
            roles: {$nin: ['productadmin']}
        })
            .select('+email +profile +campaign +username +roles')
            .populate('profile campaign')
            .exec(callback);
    });

};

var worker = function (owner, done) {
    return sendMail.apply(this, [owner, this.lastSentMailDate, this.currentDate, done]);
};

var run = function run() {
    require('../util/database').initializeDb();
    this.config = config;
    this.log = require('ypbackendlib').log(config);
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    sendMail: sendMail,
    renderMail: renderMail
};