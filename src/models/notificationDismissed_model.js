/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels;

/**
 * NotificationDismissed Schema
 * @type {Schema}
 */
var NotificationDismissedSchema = common.newSchema({
    user: {type: ObjectId, ref: 'User', required: true},
    notification: {type: ObjectId, ref: 'Notification', required: true},

    // this (the expires property) creates a mongo TTL-Index, that automatically drops a document
    // whenever the expiresAt is smaller then NOW
    // see mongo TTL Indexes for more information
    expiresAt: { type: Date, expires: 0 }

});

// we only want one dismissal per user and notification, the save method catches the
// duplicate key errors, see core/Notification.dismissNotification:128
NotificationDismissedSchema.index({user: 1, notification: 1}, {unique: true});

module.exports = mongoose.model('NotificationDismissed', NotificationDismissedSchema);
