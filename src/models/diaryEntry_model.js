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
    image: {type: String},
    refId: {type: ObjectId},
    text: {type: String},
    title: {type: String},
    feedback: {type: Number},
    dateBegin: {type: Date},
    dateEnd: {type: Date}
});


module.exports = mongoose.model('DiaryEntry', DiaryEntrySchema);
