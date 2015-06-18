/**
 * Goals Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
//    genericHandlers = require('ypbackendlib').handlers,
    routes = require('ypbackendlib').routes;


module.exports = function (swagger) {
    routes.addGenericRoutes(swagger, mongoose.model('Category'), '/categories');
};