/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Schema.ObjectId,
    enums = require('./enums'),
    common = require('ypbackendlib').commmonModels;


var TemplateCampaignOfferSchema = common.newSchema({
        idea: { type: ObjectId, ref: 'Idea', required: true },
        type: { type: String, trim: true, required: true, enum: enums.templateCampaignOfferType },
        week: { type: Number, required: true },
        weekday: {type: String, required: true, enum: enums.templateCampaignOfferWeekday }
    }
);

/**
 * Topic Schema
 */
var TopicSchema = common.newSchema({
    name: {type: String, trim: true, required: true},
    shortDescription: {type: String, trim: true, i18n: true},
    text: {type: String, trim: true, i18n: true},
    picture: {type: String},

    templateCampaignOffers: [ TemplateCampaignOfferSchema ]
});

module.exports = mongoose.model('Topic', TopicSchema);
