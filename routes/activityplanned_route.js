/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlanned'),
    genericRoutes = require('./generic'),
    passport = require('passport');


module.exports = function (app, config) {

    var baseUrl = '/api/v1/activitiesPlanned';

    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.getAllFn(baseUrl, Model));
    app.get(baseUrl+'/:id', passport.authenticate('basic', { session: false }), genericRoutes.getByIdFn(baseUrl, Model));
    app.post(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.postFn(baseUrl, Model));
    app.put(baseUrl+'/:id', passport.authenticate('basic', { session: false }), genericRoutes.putFn(baseUrl, Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));
};
