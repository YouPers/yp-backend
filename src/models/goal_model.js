/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels;

/**
 * Goal Schema
 * @type {Schema}
 */
var GoalSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    title: {type: String},
    categories: [{type: ObjectId, ref: "Category"}],
    timesCount: {type: Number},
    timeFrame: {type: String, default: 'week'}
});

GoalSchema.plugin(require('mongoose-eventify'));

GoalSchema.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this Goal'
    };
};

module.exports = mongoose.model('Goal', GoalSchema);
