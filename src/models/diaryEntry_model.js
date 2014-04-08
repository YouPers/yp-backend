/**
 * Created by retoblunschi on 08.04.14.
 */
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
var DiaryEntrySchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    type: {type: String, enum: ['manual','activityEvent'], required: true},
    activityPlan: {type: ObjectId, ref: 'ActivityPlan'},
    text: {type: String},
    mood: {type: Number}
});


module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
