var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    mongoose = require('mongoose'),
    NotificationModel = mongoose.model('Notification'),
    NotificationDismissedModel = mongoose.model('NotificationDismissed'),
    ALL_YOUPERS_QUEUE = "AAAAc64e53d523235b07EEEE",
    moment = require('moment'),
    genericHandlers = require('../handlers/generic'),
    error = require('../util/error'),
    _ = require('lodash');

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

    NotificationDismissedModel.find({ user: user.id }, function(err, nd) {

        if(err) {
            cb(err);
        }

        var dismissedNotifications = _.map(nd, 'notification');

        var myQueues = [ALL_YOUPERS_QUEUE].concat(user.getPersonalNotificationQueues());
        var now = moment().toDate();
        var query = NotificationModel
            .where({
                targetQueue: { $in: myQueues }
            })
            .and({_id: { $nin: dismissedNotifications }})
            .and({$or: [{publishTo: {$exists: false}}, {publishTo: {$gte: now}}]})
            .and({$or: [{publishFrom: {$exists: false}}, {publishFrom: {$lte: now}}]});

        genericHandlers.processDbQueryOptions(options, query, NotificationModel)
            .exec(cb);

    });

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


/**
 * dismissed a Notification for the current user
 *
 * internally this method checks whether the notification can really be delete or only dismissed.
 * Delete is possible if the requesting user is the only recipient of this notification.
 * When there are multiple recipients the notification is only hidden.
 *  *
 * @param notificationId ObjectId of notification to be deleted
 * @param user
 * @param cb
 */
Notification.dismissNotification = function dismissNotification(notificationId, user, cb) {


    NotificationModel.findById(notificationId, function(err, notification) {

        if(err) {
            cb(err);
        }

        var userId = (user._id ? user._id : user);

        // just delete the notification if it is a personal invitation for this user
        if(notification.targetQueue.equals(userId)) {
            return notification.remove(cb);
        }

        var notificationDismissed = new NotificationDismissedModel({
            expiresAt: notification.publishTo,
            user: userId,
            notification: notification.id
        });

        return notificationDismissed.save(cb);

    });

};

module.exports = Notification;
