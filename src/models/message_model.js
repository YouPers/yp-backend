/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
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
