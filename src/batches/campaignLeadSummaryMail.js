var mongoose = require('ypbackendlib').mongoose,
    moment = require('moment-timezone'),
    _ = require('lodash'),
    async = require('async'),
    email = require('../util/email'),
    batch = require('ypbackendlib').batch,
    config = require('../config/config');

require('../util/moment-business').addBusinessMethods(moment);

var mailType = 'campaignLeadSummaryMail';

/*
 *  gather locals for campaign lead summary mail
 */
var getMailLocals = function getMailLocals(user, currentDate, callback) {

    var locals = {
        user: user.toJSON(),
        currentDate: currentDate,
        campaignId: user.campaign._id.toString()
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
    var startOfDay = moment(currentDate).tz('Europe/Zurich').startOf('day').toDate();
    var endOfDay = moment(currentDate).tz('Europe/Zurich').endOf('day').toDate();


    var tasks = [];


    async.parallel(tasks, function (err) {
        if(err) {
            return callback(err);
        }

        callback(err, locals);
    });


};

var renderMail = function renderMail(user, currentDate, req, callback) {

    getMailLocals(user, currentDate, function (err, locals) {
        if(err) {
            return callback(err);
        }

        var mailLocals = email.getStandardMailLocals(mailType, locals, req.i18n);
        req.log.debug(mailLocals, "using these Locals for dailySummary");
        email.renderEmailTemplate(mailType, mailLocals, callback);
    });
};

/**
 * worker function that sends a weekly summary mail for one specific campaign lead.
 * @param user an object with a "_id" property containing the id of the user for which to send an email.
 *             can be a full user object or just an object with this "_id" property.
 * @param currentDate
 * @param done
 * @param context
 */
var sendMail = function sendMail(user, currentDate, done, context) {
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

            // if no currentDate is provided, use now
            currentDate = currentDate ? moment(currentDate) : moment();


            // check if weeklyCampaignLeadMail is enabled in the user's profile
            if(!user.profile.prefs.email.weeklyCampaignLeadMail) {
                log.debug('WeeklyCampaignLeadSummary not sent, disabled in profile: ' + user.email);
                return done();
            }

            // check if the weekly recurrence is met
            if(_ordinalNumber(user.campaign.start, currentDate) === false) {
                log.debug('WeeklyCampaignLeadSummary not sent, weekly recurrence not met: ' + user.email + 'campaign.start: ' + user.campaign.start);
                return done();
            }


            getMailLocals(user, currentDate.toDate(), function (err, locals) {

                i18n.setLng(user.profile.language || 'de');

                log.info('sending WeeklyCampaignLeadSummary Mail to email: ' + user.email);

                email.sendStandardMail.apply(this, [mailType, user.email, locals, user, i18n]);

                mongoose.model('User').update({ _id: user._id },
                    {
                        $set: {
                            lastSummaryMail: currentDate.toDate()
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


/**
 * calculate the ordinal number of the weekly mail
 * starting the day after startDate and only considering business days
 *
 * returns false if no ordinal number is found
 *
 * for example return
 * - "0" if now is the 2nd
 * - "1" if now is the 7th work day since the startDate
 * - "false" for days between the weekly recurrence
 *
 * @param startDate
 * @param now
 * @returns {number}
 * @private
 */
function _ordinalNumber(startDate, now) {
    var offset = 1; // offset from startDate (second day of campaign)
    var every = 5; // every n-th day from the start after adding the offset
    var daysSinceStart = moment(startDate).businessAdd(offset).businessDiff(moment(now));
    return daysSinceStart % every === 0 ? daysSinceStart / every : false;
}

var feeder = function (callback) {
    var log = this.log;
    var now = moment();

    log.debug("Finding all campaign leads with a currently active campaign today: " + now);

    mongoose.model('Campaign').find({
        start: { $lt: now.toDate() },
        end: { $gt: now.toDate() }
    }, { campaignLeads: 1 }).populate('campaignLeads').exec(function (err, campaigns) {
        if(err) {
            return callback(err);
        }
        // flatten array of mapped campaign lead arrays
        var campaignLeads = _.flatten(_.map(campaigns, 'campaignLeads'));
        mongoose.model('User').find({ _id: { $in: campaignLeads } }).exec(callback);
    });

};

var worker = function (owner, done) {
    return sendMail.apply(this, [owner, this.currentDate, done]);
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