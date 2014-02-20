var stats = require('../util/stats'),
    error = require('../util/error');


var getStats = function () {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        var type = req.params.type;
        if (!type) {
            return next(new error.MissingParameterError({ required: 'type' }));
        }
        var query = stats.queries(req.params.range,req.params.scopeType, req.params.scopeId)[type];

        query.exec(function (err, result) {
            if (err) { return error.handleError(err, next); }
            res.send(result);
            return next();
        });


    };
};

module.exports = {
    getStats: getStats
};