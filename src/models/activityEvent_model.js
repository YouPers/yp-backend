/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    enums = require('./enums');

/**
 * ActivityEvent Schema
 * @type {Schema}
 */
var ActivityEventSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    campaign: {type: ObjectId, ref: 'Campaign'},
    idea: {type: ObjectId, ref: 'Idea', required: true},
    activity: {type: ObjectId, ref: 'Activity', required: true},
    status: {type: String, enum: enums.activityEventStatus, required: true},
    start: {type: Date, required: true},
    end: {type: Date, required: true},
    doneTs: {type: Date},
    feedback: {type: Number},
    comment: {type: String}
});
ActivityEventSchema.plugin(require('mongoose-eventify'));

ActivityEventSchema.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this ActivityEvent'
    };
};

module.exports = mongoose.model('ActivityEvent', ActivityEventSchema);
