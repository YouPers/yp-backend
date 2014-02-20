var getNewestResult = function (baseUrl, Model) {
    return function (req, res, next) {
        Model.find({assessment: req.params.assId, owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, result) {
                if (err) {
                    return next(err);
                }
                req.log.trace({foundAssResults: result}, 'GET Newest Ass Results');
                if (!result || result.length === 0){
                    res.send([]);
                    return next();
                }
                res.send(result[0]);
                return next();
            });
    };
};


module.exports = {
    getNewestResult: getNewestResult
};