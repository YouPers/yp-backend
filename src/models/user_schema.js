/**
 * Module dependencies.
 */

var mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Schema.ObjectId;

/**
 * User Schema Extension
 * @type {Schema}
 */


module.exports = {

    campaign: {type: ObjectId, ref: 'Campaign', select: false}

};
