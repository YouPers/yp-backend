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
var CommentSchema = new Schema({
    author: {type: ObjectId, ref: 'User', required: true},
    refObj: {type: ObjectId},
    date: {type: Date, required: true},
    text: {type: String, required: true}
});


mongoose.model('Comment', CommentSchema);

common.initializeDbFor(mongoose.model('Comment'));