/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

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

NotificationDismissedSchema.index({user: 1, notification: 1}, {unique: true, dropDups: true });

module.exports = mongoose.model('NotificationDismissed', NotificationDismissedSchema);
