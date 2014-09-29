/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    ObjectId = mongoose.Schema.ObjectId,
    auth = require('ypbackendlib').auth;

/**
 * Idea Schema
 */
var IdeaSchema = common.newSchema({
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true, required: true, i18n: true },
    description: { type: String, trim: true, required: true, i18n: true },
    text: {type: String, trim: true, i18n: true},
    source: { type: String, enum: common.enums.source},
    author: {type: ObjectId, ref: 'User', required: false},
    campaign: {type: ObjectId, ref: 'Campaign'},
    defaultfrequency: {type: String, enum: common.enums.activityFrequency},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultduration: {type: Number},
    topics: [{type: ObjectId, ref: 'Topic'}],
    qualityFactor: {type: Number, select: false},
    recWeights: {type: mongoose.Schema.Types.Mixed, select: false},

    action: { type: String, enum: common.enums.actionType }

});

IdeaSchema.statics.adminAttrsSelector =  '+recWeights +qualityFactor';

IdeaSchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin];

IdeaSchema.methods.getPictureUrl = function() {
    return '/assets/actpics/' + this.number + '.jpg';
};

module.exports = mongoose.model('Idea', IdeaSchema);