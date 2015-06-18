/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels;

/**
 * Category Schema
 * @type {Schema}
 */
var CategorySchema = common.newSchema({
    name: {type: String, i18n: true},
    key: {type: String, required: true},
    goalTitleTemplate: {type: String, i18n: true},
    topic: {type: ObjectId, ref: 'Topic'}

});
CategorySchema.plugin(require('mongoose-eventify'));

module.exports = mongoose.model('Category', CategorySchema);
