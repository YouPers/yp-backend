/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Invitation Schema
 * @type {Schema}
 */
var InvitationSchema = common.newSchema({

    idea: {type: ObjectId, ref: 'Idea'}

}, undefined, AbstractSocialInteractionSchema);

InvitationSchema.plugin(require('mongoose-eventify'));

module.exports = SocialInteraction.discriminator('Invitation', InvitationSchema);
