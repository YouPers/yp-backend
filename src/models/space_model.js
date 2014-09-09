/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');

/**
 * Space Schema
 * @type {Schema}
 */
var SpaceSchema = common.newSchema({

    type: { type: String, enum: common.enums.targetSpace, required: true },
    targetId: {type: Schema.Types.Mixed}
});

SpaceSchema.methods = {
    typeToModelMap: {
        'user': 'User',
        'campaign': 'Campaign',
        'activity': 'Activity'
    },
    toJsonConfig: {
        include: ['user']
    }
};


SpaceSchema.virtual('targetModel')
    .get(function targetModel() {
       return this.typeToModelMap[this.type];
    });

module.exports = mongoose.model('Space', SpaceSchema);
