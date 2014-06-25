/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Invitation Schema
 * @type {Schema}
 */
var InvitationSchema = common.newSchema({

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Invitation', InvitationSchema);
