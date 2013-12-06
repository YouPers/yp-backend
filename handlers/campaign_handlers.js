var stats = require('../logic/stats');

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

module.exports = {
    getCampaignStats: getCampaignStats
};