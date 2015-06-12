/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Message Schema
 * @type {Schema}
 */
var MessageSchema = common.newSchema({

    language: { type: String, trim: true},
    important: { type: Boolean, default: false },
    activity: {type: ObjectId, ref: 'Activity', required: false}

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Message', MessageSchema);
