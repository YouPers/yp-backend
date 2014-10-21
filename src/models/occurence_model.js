/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    enums = require('./enums');

/**
 * Occurence Schema
 * @type {Schema}
 */
var OccurenceSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    campaign: {type: ObjectId, ref: 'Campaign'},
    idea: {type: ObjectId, ref: 'Idea', required: true},
    event: {type: ObjectId, ref: 'Event', required: true},
    status: {type: String, enum: enums.occurenceStatus, required: true},
    start: {type: Date, required: true},
    end: {type: Date, required: true},
    doneTs: {type: Date},
    feedback: {type: Number},
    comment: {type: String}
});
OccurenceSchema.plugin(require('mongoose-eventify'));

OccurenceSchema.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this Occurence'
    };
};

module.exports = mongoose.model('Occurence', OccurenceSchema);
