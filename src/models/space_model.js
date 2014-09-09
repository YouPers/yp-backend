/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Space Schema
 * @type {Schema}
 */
var SpaceSchema = common.newSchema({

    type: { type: String, enum: common.enums.targetSpace, required: true },
    targetId: {type: ObjectId} // TODO: we need a place to store the email address for invitations, using Schema.Types.Mixed here breaks the tests
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
