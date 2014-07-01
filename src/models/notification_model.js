/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common'),
    notificationTypes = ['Message', 'Invitation', 'Recommendation'],
    sourceTypes = ['youpers', 'campaign', 'community'];

/**
 * Notification Schema
 * @type {Schema}
 */
var NotificationSchema = common.newSchema({
    author: {type: ObjectId, ref: 'User', required: true},
    type: {type: String, enum: notificationTypes, required: true},
    sourceType: {type: String, enum: sourceTypes, required: true},
    refDocs: [{ docId: {type: ObjectId}, model: {type: String}}],
    title: {type: String},  // redundant information used to display information the referenced Doc
    refDocLink: {type:String},    // link the user navigates to when clicking on this notification)
    targetQueue: {type: ObjectId, required: true}, // queue this notification is published to, may be any objectId
    text: {type: String},
    publishFrom: {type: Date},
    publishTo: {type: Date}
});


module.exports = mongoose.model('Notification', NotificationSchema);
