/**
 * Goals Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
//    genericHandlers = require('ypbackendlib').handlers,
    routes = require('ypbackendlib').routes,
    config = require('../config/config');



module.exports = function (swagger) {
    routes.addGenericRoutes(swagger, mongoose.model('Category'), '/categories', null, config);
};