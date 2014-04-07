/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId;

/**
 * Activity Schema
 */
var GoalSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    campaign: { type: ObjectId, ref:  'Campaign'},
    topic: {type: String, trim: true},
    healthPromoter: {type: ObjectId},
    start: {type: Date},
    end: {type: Date}
});

GoalSchema.statics.getFieldDescriptions = function() {
    return {
        owner: 'Reference to user owning this goal, can be populated using "populate"',
        campaign: 'Reference to campaign under which this goal has been set',
        topic: 'the healthtopic this goal is referencing to',
        healthPromoter: 'Reference to the HealthPromoter, that had initiated the campaign this goal belongs to',
        start: 'the start date of this goal',
        end: 'the end date of this goal'
    };
};

module.exports = mongoose.model('Goal', GoalSchema);
