/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlan'),
    genericHandlers = require('./../handlers/generic'),
    passport = require('passport'),
    handlers = require('../handlers/activityplan_handlers');



module.exports = function (app, config) {

    var baseUrl = '/activityplans';


    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericHandlers.getAllFn(baseUrl, Model));
    app.get(baseUrl + '/joinOffers', passport.authenticate('basic', { session: false }), genericHandlers.getAllFn(baseUrl, Model, true));
    app.get(baseUrl + '/:id/ical.ics', handlers.getIcalStringForPlan);
    app.get(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericHandlers.getByIdFn(baseUrl, Model));

    app.del(baseUrl + '/:id', genericHandlers.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericHandlers.deleteAllFn(baseUrl, Model));

    app.post(baseUrl, passport.authenticate('basic', { session: false }), handlers.postNewActivityPlan);

    app.put(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericHandlers.putFn(baseUrl, Model));
    app.put(baseUrl + '/:planId/events/:eventId', passport.authenticate('basic', { session: false }), handlers.putActivityEvent);
};
