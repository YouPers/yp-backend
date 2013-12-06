/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Goal'),
    genericRoutes = require('./generic'),
    passport = require('passport');


module.exports = function (app, config) {

    var baseUrl = '/goals';

    app.get(baseUrl+'/swagger', passport.authenticate('basic', { session: false }), function(req, res, next) {
        res.send(Model.getSwaggerModel());
        return next();
    });

    app.get(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.getByIdFn(baseUrl, Model));

    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.getAllFn(baseUrl, Model));
    app.post(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.deleteAllFn(baseUrl, Model));
};