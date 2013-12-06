/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Goal'),
    genericHandlers = require('./../handlers/generic'),
    passport = require('passport');


module.exports = function (app, config) {

    var baseUrl = '/goals';

    app.get(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericHandlers.getByIdFn(baseUrl, Model));

    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericHandlers.getAllFn(baseUrl, Model));
    app.post(baseUrl, passport.authenticate('basic', { session: false }), genericHandlers.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericHandlers.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, passport.authenticate('basic', { session: false }), genericHandlers.deleteAllFn(baseUrl, Model));
};