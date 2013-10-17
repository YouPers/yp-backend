/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Comment'),
    genericRoutes = require('./generic');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var baseUrl = '/api/v1/comments';

    app.get(baseUrl + '/:id', genericRoutes.getByIdFn(baseUrl, Model));
    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, Model));
    app.post(baseUrl, genericRoutes.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', genericRoutes.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));

};