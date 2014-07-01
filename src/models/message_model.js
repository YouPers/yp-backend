/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Message Schema
 * @type {Schema}
 */
var MessageSchema = common.newSchema({

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Message', MessageSchema);
