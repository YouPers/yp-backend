/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');
/**
 * ActivityEvent Schema
 * @type {Schema}
 */
var ActivityEvent = common.newSchema({
    owner: {type: ObjectId, ref: 'User'},
    idea: {type: ObjectId, ref: 'Idea'},
    activityPlan: {type: ObjectId, ref: 'ActivityPlan'},
    status: {type: String, enum: common.enums.activityPlanEventStatus},
    start: {type: Date},
    end: {type: Date},
    doneTs: {type: Date},
    feedback: {type: Number},
    comment: {type: String}
});

mongoose.model('ActivityEvent', ActivityEvent);


ActivityEvent.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this ActivityEvent'
    };
};


module.exports = mongoose.model('ActivityEvent', ActivityEvent);
