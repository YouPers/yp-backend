/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * SocialInteractionDismissed Schema
 * @type {Schema}
 */
var SocialInteractionDismissedSchema = common.newSchema({
    user: {type: ObjectId, ref: 'User', required: true},
    socialInteraction: {type: ObjectId, ref: 'SocialInteraction', required: true},

    // this (the expires property) creates a mongo TTL-Index, that automatically drops a document
    // whenever the expiresAt is smaller then NOW
    // see mongo TTL Indexes for more information
    expiresAt: { type: Date, expires: 0 }

});

// we only want one dismissal per user and notification, the save method catches the
// duplicate key errors, see core/Notification.dismissNotification:128
SocialInteractionDismissedSchema.index({user: 1, notification: 1}, {unique: true});

module.exports = mongoose.model('SocialInteractionDismissed', SocialInteractionDismissedSchema);
