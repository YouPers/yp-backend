var statsQueries = require('../stats/statsQueries'),
    error = require('ypbackendlib').error,
    async = require('async'),
    moment = require('moment'),
    mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    _ = require('lodash');



function constructQuery(queryDef, scopeType, scopeId, timeRange) {
    var pipe = mongoose.model(queryDef.modelName).aggregate();

    if ((scopeType === 'owner') || (scopeType === 'campaign')) {
        // scope can be 'owner', 'campaign', 'all'
        if (!scopeId) {
            throw new Error("Illegal Arguments, when ScopeType == campaign or owner, an id has to be passed");
        }
        var scopePipelineEntry = {$match: {}};
        scopePipelineEntry.$match[scopeType] = new ObjectId(scopeId);
        pipe.append(scopePipelineEntry);
    } else if (scopeType === 'all') {
        // do nothing, consider all rows
    } else {
        throw new Error('Unknown ScopeType: ' + scopeType);
    }

    if (timeRange && (timeRange !== 'all')) {
        pipe.append({
            $match: {
                'start': {
                    $gt: moment().startOf(timeRange).toDate(),
                    $lt: moment().endOf(timeRange).toDate()
                }
            }
        });
    }
    // despite the documentation, aggregate.append() does not like arrays.. so we do it piece per piece
    _.forEach(queryDef.stages, function (stage) {
        pipe.append(stage);
    });
    return pipe;
}

var getStats = function () {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        var type = req.params.type;
        if (!type) {
            return next(new error.MissingParameterError({ required: 'type' }));
        }
        var scopeType = req.params.scopeType || 'all';
        var scopeId = req.params.scopeId;
        var timeRange = req. params.timeRange;

        var queryDefs = {};
        try {
            if (type === 'all') {
                queryDefs = statsQueries;
            } else {
                queryDefs[type] = statsQueries[type];
            }
        } catch (err) {
            req.log.info(err);
            return next(new error.InvalidArgumentError(err.message));
        }

        var locals = {};

        async.each(_.keys(queryDefs), function (queryName, done) {

            var myWaterFall = [
                function(cb) {
                    var q = constructQuery(queryDefs[queryName], scopeType, scopeId, timeRange);
                    q.exec(function (err, result) {
                        if (err) {
                            return error.handleError(err, cb);
                        }
                        return cb(null, result, req.locale);
                    });
                }
            ];

            if (queryDefs[queryName].transformers) {
                var transformers = _.isArray(queryDefs[queryName].transformers) ? queryDefs[queryName].transformers : [queryDefs[queryName].transformers];
                myWaterFall = myWaterFall.concat(transformers);
            }

            async.waterfall(myWaterFall, function (err, result) {
                if (err) {
                    return error.handleError(err, done);
                }
                locals[queryName] = result;
                return done();
            });

        }, function (err) {
            if (err) {
                return error.handleError(err, next);
            }
            res.send([locals]);
            return next();
        });
    };
};

module.exports = {
    getStats: getStats
};