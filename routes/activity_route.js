/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Activity'),
    genericRoutes = require('./generic');


module.exports = function (app, config) {

    var baseUrl = '/api/v1/activities';

    var deleteFn = function(req,res,next) {
        Model.remove(function(err) {
            if (err) {
                return  next(err);
            }
            res.send(200);
        });
    };

    app.get(baseUrl, genericRoutes.getAllFn(baseUrl,Model));
    app.get(baseUrl+'/:id', genericRoutes.getByIdFn(baseUrl,Model));
    app.post(baseUrl, genericRoutes.postFn(baseUrl,Model));
    app.del(baseUrl, deleteFn);

};