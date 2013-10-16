/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    genericRoutes = require('./generic');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var baseUrl = '/api/v1/users';

    var deleteUser = function(req,res,next) {
        User.remove(function(err) {
           if (err) {
               return  next(err);
           }
            res.send(200);
        });
    };

    app.get(baseUrl + '/:id', genericRoutes.getByIdFn(baseUrl, User));
    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, User));
    app.post(baseUrl, genericRoutes.postFn(baseUrl, User));
    app.del(baseUrl, deleteUser);

};