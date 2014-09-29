/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels;

/**
 * Space Schema
 * @type {Schema}
 */
var SpaceSchema = common.newSchema({

    type: { type: String, enum: common.enums.targetSpace, required: true },
    targetId: {type: ObjectId},
    targetValue: {type: String}
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
