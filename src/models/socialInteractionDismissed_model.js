/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    enums = require('./enums');

/**
 * SocialInteractionDismissed Schema
 * @type {Schema}
 */
var SocialInteractionDismissedSchema = common.newSchema({
    user: {type: ObjectId, ref: 'User', required: true},
    socialInteraction: {type: ObjectId, ref: 'SocialInteraction', required: true},
    reason: {type: String, enum: enums.dismissalReason }

});

// we only want one dismissal per user and notification, the save method catches the duplicate key errors
SocialInteractionDismissedSchema.index({user: 1, socialInteraction: 1}, {unique: true});

module.exports = mongoose.model('SocialInteractionDismissed', SocialInteractionDismissedSchema);
