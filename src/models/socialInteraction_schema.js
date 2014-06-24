
var mongoose = require('mongoose'),
    util = require('util'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    Space = mongoose.model('Space');

function AbstractSocialInteractionSchema() {
    Schema.apply(this, arguments);

    this.add({

        targetSpaces: [Space.schema],

        publishFrom: {type: Date},
        publishTo: {type: Date},

        author: {type: ObjectId, ref: 'User', required: true}

    });
}

util.inherits(AbstractSocialInteractionSchema, Schema);

module.exports = AbstractSocialInteractionSchema;