/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Comment Schema
 * @type {Schema}
 */
var CommentSchema = common.newSchema({
    author: {type: ObjectId, ref: 'User', required: true},
    refDoc: {type: ObjectId},
    refDocModel: {type: String},
    refDocPath: {type: String},   // subPath inside the doc, if the comment refers to a subPath inside the doc
    refDocTitle: {type: String},
    refDocLink: {type:String},
    created: {type: Date, required: true},
    text: {type: String, required: true},
    subcomments: [{type: ObjectId, ref: 'Comment'}]
});


mongoose.model('Comment', CommentSchema);

common.initializeDbFor(mongoose.model('Comment'));