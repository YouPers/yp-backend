/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    enums = require('./enums');

/**
 * Space Schema
 * @type {Schema}
 */
var SpaceSchema = common.newSchema({

    type: { type: String, enum: enums.targetSpace, required: true },
    targetId: {type: ObjectId},
    targetValue: {type: String}
});

SpaceSchema.methods = {
    typeToModelMap: {
        'user': 'User',
        'campaign': 'Campaign',
        'event': 'Event'
    },
    toJsonConfig: function () {
        return {
            include: ['user']
        };

    }
};


SpaceSchema.virtual('targetModel')
    .get(function targetModel() {
       return this.typeToModelMap[this.type];
    });

module.exports = mongoose.model('Space', SpaceSchema);
