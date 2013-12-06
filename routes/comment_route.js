/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Comment'),
    genericHandlers = require('./../handlers/generic');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var baseUrl = '/comments';

    app.get(baseUrl + '/:id', genericHandlers.getByIdFn(baseUrl, Model));
    app.get(baseUrl, genericHandlers.getAllFn(baseUrl, Model));
    app.post(baseUrl, genericHandlers.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', genericHandlers.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericHandlers.deleteAllFn(baseUrl, Model));

};