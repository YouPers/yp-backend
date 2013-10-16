/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Assessment'),
    genericRoutes = require('./generic');


module.exports = function (app, config) {

    var baseUrl = '/api/v1/assessment';

    app.get(baseUrl, genericRoutes.getAllFn(baseUrl,Model));
    app.get(baseUrl+'/:id', genericRoutes.getByIdFn(baseUrl,Model));
    app.post(baseUrl, genericRoutes.postFn(baseUrl,Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));

};