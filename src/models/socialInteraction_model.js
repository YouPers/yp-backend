/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');


/**
 * SocialInteraction Schema
 */
var SocialInteractionSchema = common.newSchema({

}, {
    collection: 'socialInteractions' // needed in order to have the discriminator models stored in the same collection, see https://github.com/LearnBoost/mongoose/issues/1805
}, AbstractSocialInteractionSchema);


SocialInteractionSchema.methods = {

    toJsonConfig: {
        include: ['rejected', 'dismissed', 'dismissalReason']
    }

};

module.exports = mongoose.model('SocialInteraction', SocialInteractionSchema);
