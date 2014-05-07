var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    mongoose = require('mongoose'),
    NotificationModel = mongoose.model('Notification'),
    ALL_YOUPERS_QUEUE = "AAAAc64e53d523235b07EEEE",
    moment = require('moment'),
    genericHandlers = require('../handlers/generic'),
    error = require('../util/error');

function Notification(aNotification) {
    EventEmitter.call(this);
    var self = this;

    aNotification.created = new Date();
    self.notification = aNotification;
}

util.inherits(Notification, EventEmitter);

Notification.prototype.publish = function(cb) {

    // validation
    if (!this.notification) {
        return cb(new Error('missing parameter, pass the notification object into the constructor of Notification'));
    }

    var myNotification = new NotificationModel(this.notification);

    myNotification.save(function(err, savedNotification) {
        if (err) {
            return cb(err);
        }
         return cb(null, savedNotification);
    });

};

Notification.getCurrentNotifications = function(user, options, cb) {
    var myQueues = [ALL_YOUPERS_QUEUE].concat(user.getPersonalNotificationQueues());
    var now = moment().toDate();
    var query = NotificationModel
        .where({ targetQueue: {$in: myQueues}})
        .and({$or: [{publishTo: {$exists: false}}, {publishTo: {$gte: now}}]})
        .and({$or: [{publishFrom: {$exists: false}}, {publishFrom: {$lte: now}}]});

    genericHandlers.processDbQueryOptions(options, query, NotificationModel)
        .exec(cb);
};

Notification.getCampaignNotifications = function(user, campaign, mode, previewDate, options, cb) {
    var myQueues = [campaign.id || campaign];

    var query = NotificationModel
        .where({ targetQueue: {$in: myQueues}});

    if (mode === 'administrate') {
        // only the manual Notifications can be administrated, the Notification for Events and Recommendations must
        // be administrated by changing the respective CampaignActivityEvent or CampaignActivityRecommendation.
        query.where({ type: 'message'});
    } else if (mode=== 'preview') {
        var dateToUse = new Date(moment(previewDate)) || moment().toDate();
        query
            .and({$or: [{publishTo: {$exists: false}}, {publishTo: {$gte: dateToUse}}]})
            .and({$or: [{publishFrom: {$exists: false}}, {publishFrom: {$lte: dateToUse}}]});
    } else {
        return cb(new error.InvalidArgumentError('Unknown mode: ' + mode));
    }


    genericHandlers.processDbQueryOptions(options, query, NotificationModel)
        .exec(cb);
};


module.exports = Notification;
