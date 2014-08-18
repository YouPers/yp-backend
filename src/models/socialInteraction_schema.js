
var mongoose = require('mongoose'),
    util = require('util'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    Space = mongoose.model('Space'),
    _ = require('lodash'),
    common = require('./common');

function AbstractSocialInteractionSchema() {
    Schema.apply(this, arguments);

    this.add({

        targetSpaces: [Space.schema],

        publishFrom: {type: Date},
        publishTo: {type: Date},

        author: {type: ObjectId, ref: 'User', required: true},
        authorType: {type: String, enum: common.enums.authorType, required: true, default: 'user'},

        title: {type: String, required: false},
        text: {type: String, required: false},
        refDocs: [{ docId: {type: ObjectId}, model: {type: String}, doc: Schema.Types.Mixed}]

    });
}

util.inherits(AbstractSocialInteractionSchema, Schema);


AbstractSocialInteractionSchema.methods = {

    isTargeted: function(user) {

        // TODO: enable targetSpace types [ activity, email ]

        return _.any(this.targetSpaces, function(space) {

            return space.type === 'system' ||
                space.targetId.equals(user._id) ||
                space.targetId.equals(user.campaign);
        });

    }

};

module.exports = AbstractSocialInteractionSchema;