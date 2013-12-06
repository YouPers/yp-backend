/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Campaign'),
    genericHandlers = require('../handlers/generic'),
    handlers = require('../handlers/campaign_handlers');


module.exports = function (app, config) {

    var baseUrl = '/campaigns';

    app.get(baseUrl + '/:id', genericHandlers.getByIdFn(baseUrl, Model));
    app.get(baseUrl + '/:id/stats', handlers.getCampaignStats(baseUrl, Model));
    app.get(baseUrl, genericHandlers.getAllFn(baseUrl, Model));
    app.post(baseUrl, genericHandlers.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', genericHandlers.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericHandlers.deleteAllFn(baseUrl, Model));
};