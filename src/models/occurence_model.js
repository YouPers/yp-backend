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
    owner: {type: ObjectId, ref: 'User'},
    campaign: {type: ObjectId, ref: 'Campaign'},
    idea: {type: ObjectId, ref: 'Idea'},
    event: {type: ObjectId, ref: 'Event'},
    status: {type: String, enum: enums.occurenceStatus},
    start: {type: Date},
    end: {type: Date},
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
