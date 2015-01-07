var mongoose = require('ypbackendlib').mongoose,
    moment = require('moment-timezone'),
    _ = require('lodash'),
    async = require('async'),
    email = require('../util/email'),
    batch = require('ypbackendlib').batch,
    modelNames = require('../models').modelNames,
    config = require('../config/config');

/*
 *  gather locals for daily summary mail
 */
var getSummaryMailLocals = function getSummaryMailLocals(user, rangeStart, rangeEnd, callback) {

    var locals = {
        user: user.toJSON(),
        rangeStart: rangeStart,
        rangeEnd: rangeEnd,
        campaignOffers: []
    };

    var storeLocals = function (localKey, done) {
        return function (err, result) {
            if(err) { return err; }
            locals[localKey] = result.toJSON ? result.toJSON() : result;
            if(_.isArray(result)) {
                locals[localKey + 'Count'] = result.length;
                for(var i=0;i<result.length; i++) {
                    result[i] = result[i].toJSON ? result[i].toJSON() : result[i];
                }
            }
            done(err, result);
        };
    };

    // TODO: use proper timezone of the user here
    var startOfDay = moment(rangeEnd).tz('Europe/Zurich').startOf('day').toDate();
    var endOfDay = moment(rangeEnd).tz('Europe/Zurich').endOf('day').toDate();

    var dismissedSocialInteractions = [];

    var tasks = [

        // section 1


        // personalActivities
        function (done) {
            mongoose.model('Activity').count({
                campaign: user.campaign,
                $or: [
                    { owner: user._id },
                    { joiningUsers: user._id }
                ]
            }).exec(storeLocals('personalActivities', done));
        },

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
                start: { $gt: startOfDay, $lt: endOfDay }
            }).populate('activity').populate('idea').exec(storeLocals('eventsToday', done));
        },

        // eventsWithOpenFeedback
        function (done) {
            mongoose.model('ActivityEvent').find({
                owner: user._id || user,
                campaign: user.campaign,
                status: 'open',
                end: { $lt: moment() }
            }).populate('activity').populate('idea').exec(storeLocals('eventsWithOpenFeedback', done));
        },

        // section 3

        // newCampaignMessages
        function (done) {
            mongoose.model('Message').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: rangeEnd },
                publishTo: { $gt: rangeEnd }
            }).populate('author').exec(storeLocals('newCampaignMessages', done));
        },

        // newCampaignActivityInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: rangeEnd },
                publishTo: { $gt: rangeEnd }
            }).populate('author activity').exec(storeLocals('newCampaignActivityInvitations', done));
        },

        // newCampaignRecommendations
        function (done) {
            mongoose.model('Recommendation').find({
                _id: { $nin: dismissedSocialInteractions },
                authorType: 'campaignLead',
                targetSpaces: { $elemMatch: { targetId: user.campaign }},
                publishFrom: { $gt: rangeStart, $lt: rangeEnd },
                publishTo: { $gt: rangeEnd }
            }).populate('author idea').exec(storeLocals('newCampaignRecommendations', done));
        },

        // newPersonalInvitations
        function (done) {
            mongoose.model('Activity').find({ campaign: user.campaign }, { _id: 1 }).exec(function (err, activities) {
                var activityIds = _.map(activities, '_id');
                mongoose.model('Invitation').find({
                    _id: { $nin: dismissedSocialInteractions },
                    activity: { $in: activityIds},
                    authorType: 'user',
                    targetSpaces: { $elemMatch: { targetId: user.id }},
                    publishFrom: { $gt: rangeStart, $lt: rangeEnd },
                    publishTo: { $gt: rangeEnd }
                }).populate('author activity').exec(storeLocals('newPersonalInvitations', done));
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
            }, { _id: 1 }).exec(function (err, activities) {
                var activityIds = _.map(activities, '_id');

                mongoose.model('Message').count({
                    _id: {$nin: dismissedSocialInteractions},
                    authorType: 'user',
                    targetSpaces: {
                        $elemMatch: {
                            targetId: {
                                $in: activityIds
                            }
                        }
                    },
                    created: {$gt: rangeStart}
                }).exec(storeLocals('newCommentsOnParticipatedActivities', done));
            });
        },

        // newPublicInvitations
        function (done) {
            mongoose.model('Invitation').find({
                _id: {$nin: dismissedSocialInteractions},
                authorType: 'user',
                targetSpaces: {$elemMatch: {targetId: user.campaign}},
                created: {$gt: rangeStart}
            }).populate('author activity').exec(storeLocals('newPublicInvitations', done));
        },

        // newCoachRecommendations
        function (done) {
            mongoose.model('Recommendation').find({
                _id: {$nin: dismissedSocialInteractions},
                authorType: 'coach',
                targetSpaces: { $elemMatch: { targetId: user.id }},
                created: {$gt: rangeStart}
            }).populate('author idea').exec(storeLocals('newCoachRecommendations', done));
        }
    ];

    mongoose.model('SocialInteractionDismissed').find({user: user}, {socialInteraction: 1}).exec(function (err, sids) {
        dismissedSocialInteractions = _.map(sids, 'socialInteraction');

        async.parallel(tasks, function (err) {
            if(err) {
                return callback(err);
            }

            locals.campaignOffers = [].concat(
                locals.newCampaignActivityInvitations,
                locals.newCampaignRecommendations,
                locals.newPersonalInvitations,
                locals.newPublicInvitations,
                locals.newCoachRecommendations
            );
            callback(err, locals);
        });
    });


};

var renderSummaryMail = function (user, rangeStart, rangeEnd, req, callback) {

    getSummaryMailLocals(user, rangeStart, rangeEnd, function (err, locals) {
        if(err) {
            return callback(err);
        }

        var mailLocals = email.getDailyEventSummaryLocals(locals, req.i18n);
        req.log.info(mailLocals, "using these Locals for dailySummary");
        email.renderEmailTemplate('dailyEventsSummary', mailLocals, callback);
    });
};

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

    mongoose.model('User')
        .findById(user)
        .select('+email +profile +campaign +username')
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

            // if no rangeStart is provided, use the date the last mail was sent, or the start of the campaign
            rangeStart = rangeStart ? rangeStart : moment(user.lastSummaryMail) || moment(user.campaign.start);
            rangeEnd = rangeEnd ? moment(rangeEnd) : moment();


            // check if dailyUserMail is enabled in the user's profile
            if(!user.profile.prefs.email.dailyUserMail) {
                log.debug('DailySummary not sent, disabled in profile: ' + user.email);
                return done();
            }

            // check defaultWorkWeek in the user's profile
            var weekDay = rangeEnd.format('dd').toUpperCase(); // MO, TU, WE, ..
            var defaultWorkWeek = user.profile.prefs.defaultWorkWeek || ['MO', 'TU', 'WE', 'TH' , 'FR'];
            if(!_.contains(defaultWorkWeek, weekDay)){
                log.debug('DailySummary not sent, defaultWorkWeek from the user does not contain today: ' + weekDay + ', defaultWorkWeek: ' + user.profile.prefs.defaultWorkWeek + ', email: ' + user.email);
                return done();
            }


            getSummaryMailLocals(user, rangeStart.toDate(), rangeEnd.toDate(), function (err, locals) {

                i18n.setLng(user.profile.language || 'de');

                log.info('sending DailySummary Mail to email: ' + user.email);

                email.sendDailyEventSummary.apply(this, [user.email, locals, user, i18n]);

                mongoose.model('User').update({ _id: user._id },
                    {
                        $set: {
                            lastSummaryMail: rangeEnd.toDate()
                        }
                    }, function (err) {
                    if(err) {
                        return done(err);
                    }
                    return done();
                });
            });
        });
};

var feeder = function (callback) {
    var log = this.log;
    var now = moment();

    log.debug("Finding all users (excl. roles [campaignlead, productadmin], with dailyUserMail=true, and a currently active campaign today: " + now);

    mongoose.model('Campaign').find({
        start: { $lt: now.toDate() },
        end: { $gt: now.toDate() }
    }, { _id: 1 }).exec(function (err, campaigns) {
        if(err) {
            return callback(err);
        }
        mongoose.model('User').find({
            campaign: { $in: _.map(campaigns, '_id') },
            roles: { $nin: ['campaignlead', 'productadmin'] }
        }).select('+roles').exec(callback);
    });

};

var worker = function (owner, done) {
    return sendSummaryMail.apply(this, [owner, this.rangeStart, this.rangeEnd, done]);
};

var run = function run() {
    require('ypbackendlib').initializeDb(config, modelNames, __dirname + '/../models');
    this.config = config;
    this.log = require('ypbackendlib').log(config);
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    sendSummaryMail: sendSummaryMail,
    renderSummaryMail: renderSummaryMail
};