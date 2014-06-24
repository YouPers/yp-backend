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

    title: {type: String, required: true},
    text: {type: String, required: true},
    refDocs: [{ docId: {type: ObjectId}, model: {type: String}}]


}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Message', MessageSchema);
