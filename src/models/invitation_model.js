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
 * Invitation Schema
 * @type {Schema}
 */
var InvitationSchema = common.newSchema({

    idea: {type: ObjectId, ref: 'Idea'},
    activity: {type: ObjectId, ref: 'Activity'}

}, undefined, AbstractSocialInteractionSchema);

InvitationSchema.plugin(require('mongoose-eventify'));

module.exports = SocialInteraction.discriminator('Invitation', InvitationSchema);
