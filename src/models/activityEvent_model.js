/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels;

/**
 * ActivityEvent Schema
 * @type {Schema}
 */
var ActivityEventSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User'},
    campaign: {type: ObjectId, ref: 'Campaign'},
    idea: {type: ObjectId, ref: 'Idea'},
    activity: {type: ObjectId, ref: 'Activity'},
    status: {type: String, enum: common.enums.activityEventStatus},
    start: {type: Date},
    end: {type: Date},
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
