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
    type: {type: String, enum: ['manual','activityPlanEvent'], required: true},
    activityPlanEvent: {type: ObjectId, ref: 'ActivityPlanEvent'},
    activityPlan: {type: ObjectId, ref: 'ActivityPlan'},
    text: {type: String},
    feedback: {type: Number}
});


module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
