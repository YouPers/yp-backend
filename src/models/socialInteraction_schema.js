
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

        author: {type: ObjectId, ref: 'User', required: true},

        title: {type: String, required: false},
        text: {type: String, required: false},
        refDocs: [{ docId: {type: ObjectId}, model: {type: String}, doc: Schema.Types.Mixed}]

    });
}

util.inherits(AbstractSocialInteractionSchema, Schema);

module.exports = AbstractSocialInteractionSchema;