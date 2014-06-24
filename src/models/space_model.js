/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Space Schema
 * @type {Schema}
 */
var SpaceSchema = common.newSchema({

    type: { type: String, enum: common.enums.targetSpace, required: true },
    targetId: {type: ObjectId},
    targetModel: {type: String}
});

module.exports = mongoose.model('Space', SpaceSchema);
