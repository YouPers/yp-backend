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
 * Invitation Schema
 * @type {Schema}
 */
var InvitationSchema = common.newSchema({

    activity: {type: ObjectId, ref: 'Activity', required: true}

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Invitation', InvitationSchema);
