/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

/**
 * Recommendation Schema
 * @type {Schema}
 */
var RecommendationSchema = common.newSchema({

    idea: {type: ObjectId, ref: 'Idea', required: true}

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Recommendation', RecommendationSchema);
