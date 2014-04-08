/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common'),
    notificationTypes = ['message', 'personalInvite', 'publicPlan', 'activityRecommendation'];

/**
 * Notification Schema
 * @type {Schema}
 */
var NotificationSchema = common.newSchema({
    author: {type: ObjectId, ref: 'User', required: true},
    type: {type: String, enum: notificationTypes, required: true},
    refDocId: {type: ObjectId},
    refDocModel: {type: String},
    refDocTitle: {type: String},  // redundant information used to display information the referenced Doc
    refDocLink: {type:String},    // link the user navigates to when clicking on this notification)
    targetQueue: {type: ObjectId, required: true}, // queue this notification is published to, may be any objectId
    created: {type: Date, required: true},
    text: {type: String}
});


module.exports = mongoose.model('Notification', NotificationSchema);
