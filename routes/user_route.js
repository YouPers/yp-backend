/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    genericRoutes = require('./generic'),
    passport = require('passport');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var baseUrl = '/api/v1/users';

    app.get(baseUrl + '/:id', genericRoutes.getByIdFn(baseUrl, User));
    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, User));
    app.post(baseUrl, genericRoutes.postFn(baseUrl, User));
    app.del(baseUrl + '/:id', genericRoutes.deleteByIdFn(baseUrl, User));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, User));
    app.post('/api/v1/login', passport.authenticate('basic', { session: false }), function(req, res, next) {
        req.log.trace({user: req.user},'/login: user authenticated');
        res.send(req.user);
        return next();
    });
};