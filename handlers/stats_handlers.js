var stats = require('../logic/stats');


var getStats = function () {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        var type = req.params.type;
        if (!type) {
            return next(new Error('type param required for this URI'));
        }
        var query = stats.queries(req.params.range,req.params.scopeType, req.params.scopeId)[type];

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
    getStats: getStats
};