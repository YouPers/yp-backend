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

mongoose.model('Goal', GoalSchema);

common.initializeDbFor(mongoose.model('Goal'));