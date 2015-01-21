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
    properties: {
        campaign: {type: ObjectId, ref: 'Campaign', select: false}
    },
    statics: {
        privatePropertiesSelector: '+email +roles +emailValidatedFlag +hashed_password +tempPasswordFlag +profile +username +campaign'
    }
};
