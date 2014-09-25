/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('ypbackendlib').commmonModels,
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Message Schema
 * @type {Schema}
 */
var MessageSchema = common.newSchema({

    language: { type: String, trim: true},
    important: { type: Boolean, default: false }

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Message', MessageSchema);
