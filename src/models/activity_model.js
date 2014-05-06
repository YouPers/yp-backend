/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    common = require('./common'),
    ObjectId = mongoose.Schema.ObjectId,
    auth = require('../util/auth');

/**
 * Activity Schema
 */
var ActivitySchema = common.newSchema({
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true, required: true, i18n: true },
    description: { type: String, trim: true, required: true, i18n: true },
    text: {type: String, trim: true, i18n: true},
    source: { type: String, enum: common.enums.source},
    author: {type: ObjectId, ref: 'User', required: false},
    campaign: {type: ObjectId, ref: 'Campaign'},
    defaultfrequency: {type: String, enum: common.enums.activityPlanFrequency},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultvisibility: {type: String, enum: common.enums.visibility},
    defaultduration: {type: Number},
    topics: [String],
    fields: [String],
    qualityFactor: {type: Number, select: false},
    recWeights: {type: mongoose.Schema.Types.Mixed, select: false}
});

ActivitySchema.statics.adminAttrsSelector =  '+recWeights +qualityFactor';

ActivitySchema.statics.adminRoles = [auth.roles.systemadmin, auth.roles.productadmin];

ActivitySchema.methods.getPictureUrl = function() {
    return '/assets/actpics/' + this.number + '.jpg';
};

module.exports = mongoose.model('Activity', ActivitySchema);