/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Campaign'),
    genericRoutes = require('./generic'),
    stats = require('../logic/stats');




var getCampaignStats = function (baseUrl, Model) {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        if (!req.params || !req.params.id) {
            res.send(204);
            return next();
        }
        var type = req.params.type;
        if (!type) {
            return next('type param required for this URI');
        }
        var query = stats.queries(req.params.range,'campaign', req.params.id)[type];

        query.exec(function (err, result) {
            if (err) {
                return next(err);
            }
            res.send(result);
            return next();
        });


    };
};


module.exports = function (app, config) {

    var baseUrl = '/api/v1/campaigns';

    app.get(baseUrl + '/:id', genericRoutes.getByIdFn(baseUrl, Model));
    app.get(baseUrl + '/:id/stats', getCampaignStats(baseUrl, Model));
    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, Model));
    app.post(baseUrl, genericRoutes.postFn(baseUrl, Model));
    app.del(baseUrl + '/:id', genericRoutes.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));
};