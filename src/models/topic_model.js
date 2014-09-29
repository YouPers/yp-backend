/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels;
/**
 * Idea Schema
 */
var TopicSchema = common.newSchema({
    name: {type: String, trim: true, required: true},
    shortDescription: {type: String, trim: true, i18n: true},
    text: {type: String, trim: true, i18n: true},
    picture: {type: String}
});

module.exports = mongoose.model('Topic', TopicSchema);
