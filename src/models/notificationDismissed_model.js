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

    expiresAt: { type: Date, expires: 0 }

});


module.exports = mongoose.model('NotificationDismissed', NotificationDismissedSchema);
