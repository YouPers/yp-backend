/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Notification Schema
 * @type {Schema}
 */
var NotificationSchema = common.newSchema({
    author: {type: ObjectId, ref: 'User', required: true},
    refDoc: {type: ObjectId},
    refDocModel: {type: String},
    refDocPath: {type: String},   // subPath inside the doc, if the notification refers to a subPath inside the doc, e.g. one specific event
    refDocTitle: {type: String},  // redundant information used to display information the referenced Doc
    refDocLink: {type:String},    // link the user navigates to when clicking on this notification)
    targetQueue: {type: ObjectId}, // queue this notification is published to, may be any objectId
    created: {type: Date, required: true},
    text: {type: String, required: true}
});


module.exports = mongoose.model('Notification', NotificationSchema);
