/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');


/**
 * SocialInteraction Schema
 */
var SocialInteractionSchema = common.newSchema({


}, undefined, AbstractSocialInteractionSchema);

module.exports = mongoose.model('SocialInteraction', SocialInteractionSchema);
