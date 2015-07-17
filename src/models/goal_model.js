/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    moment = require('moment-timezone');

/**
 * Goal Schema
 * @type {Schema}
 */
var GoalSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    title: {type: String},
    categories: [String],
    timesCount: {type: Number, default: 1},
    timeFrame: {type: String, default: 'week'},
    start: {type: Date, default: Date.now},
    end: {type: Date, default: moment("9999-12-31")}
});

GoalSchema.plugin(require('mongoose-eventify'));

GoalSchema.methods.toJsonConfig = function() {
    return {
        include: ['thisPeriodCount', 'lastPeriodCount']
    };
};

GoalSchema.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this Goal'
    };
};

module.exports = mongoose.model('Goal', GoalSchema);
