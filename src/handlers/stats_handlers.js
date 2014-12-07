var statsQueries = require('../stats/statsQueries'),
    error = require('ypbackendlib').error,
    async = require('async'),
    moment = require('moment'),
    mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    _ = require('lodash');



function constructQuery(queryDef, options) {
    // put the modelName into options, so the transformers can access it
    options.queryModelName = queryDef.modelName;
    var pipe = mongoose.model(queryDef.modelName).aggregate();

    if ((options.scopeType === 'owner') || (options.scopeType === 'campaign') || options.scopeType === 'topic') {
        // scope can be 'owner', 'campaign', 'all'
        if (!options.scopeId) {
            throw new error.MissingParameterError("Illegal Arguments, when ScopeType == campaign or owner, an id has to be passed");
        }
        var scopePipelineEntry = {$match: {}};
        scopePipelineEntry.$match[options.scopeType] = new ObjectId(options.scopeId);
        if (!queryDef.ignoreScope) {
            pipe.append(scopePipelineEntry);
        }
    } else if (options.scopeType === 'all') {
        // do nothing, consider all rows
    } else if (options.scopeType) {
        // defined but unknown
        throw new error.InvalidArgumentError('Unknown ScopeType: ' + options.scopeType);
    } else {
        // we assume 'all' if nothing is passed
    }

    if (options.timeRange && (options.timeRange !== 'all')) {
        pipe.append({
            $match: {
                'start': {
                    $gt: moment().startOf(options.timeRange).toDate(),
                    $lt: moment().endOf(options.timeRange).toDate()
                }
            }
        });
    }
    var stages = queryDef.stages;

    // stages can be an array of Aggregation Pipeline Operators,
    // or a function returning such an array in case the options/params are needed to generate the array
    if (_.isFunction(stages)) {
        stages = stages(options);
    }

        // despite the documentation, aggregate.append() does not like arrays.. so we do it piece per piece
        _.forEach(stages, function (stage) {
            try {
                pipe.append(stage);
            } catch (err) {
                throw new Error('Error adding stage: ' + stage + ' from query: ' + queryDef);
            }
        });

    return pipe;
}

var getStats = function () {
    return function (req, res, next) {

        var type = req.params.type;
        if (!type) {
            return next(new error.MissingParameterError({ required: 'type' }));
        }

        var queryDefs = {};
        try {
            if (type === 'all') {
                queryDefs = statsQueries;
            } else {
                queryDefs[type] = statsQueries[type];
                if (!queryDefs[type])  {
                    return next(new error.InvalidArgumentError('Unknown Query Type: ' + type));
                }
            }
        } catch (err) {
            req.log.info(err);
            return next(new error.InvalidArgumentError(err.message));
        }

        var locals = {};

        var options = req.params;
        options.locale = req.locale;

        async.each(_.keys(queryDefs), function (queryName, done) {

            var myWaterFall = [
                function(cb) {

                    try {
                        var q = constructQuery(queryDefs[queryName], options);

                        q.exec(function (err, result) {
                            if (err) {
                                return error.handleError(err, cb);
                            }
                            return cb(null, result, options);
                        });
                    } catch (err) {
                        req.log.error(new Error('Error constructing query for type: ' + queryName, err));
                        return next(err);
                    }
                }
            ];

            if (queryDefs[queryName].transformers) {
                var transformers = _.isArray(queryDefs[queryName].transformers) ?
                    queryDefs[queryName].transformers :
                    [queryDefs[queryName].transformers];

                myWaterFall = myWaterFall.concat(transformers);
            }

            async.waterfall(myWaterFall, function (err, result) {
                if (err) {
                    return done(err);
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