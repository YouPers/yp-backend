var stats = require('../util/stats'),
    error = require('../util/error'),
    async = require('async'),
    mongoose = require('mongoose'),
    ObjectId = mongoose.Types.ObjectId,
    _ = require('lodash');

var id2humanReadableString = {};
(function loadIdResolveCache () {
    var cachedModels = ['Idea', 'AssessmentQuestion'];

    async.forEach(cachedModels, function(modelName, done) {
        mongoose.model(modelName).find().exec(function(err, docs) {
            _.forEach(docs, function(doc) {
                id2humanReadableString[doc._id] = doc.getStatsString();
            });
            return done();
        });
    }, function(err) {
        if (err) {throw err;}

    });
} ());

function _replaceIdsByString(obj) {
    _.forEach(obj, function(value, key) {
        if (_.isArray(value)) {
            _replaceIdsByString(value);
        } else if (value instanceof ObjectId || value instanceof String) {
            obj[key] =  id2humanReadableString[value] || value;
        } else if (_.isObject(value)) {
            _replaceIdsByString(value);

        } else {
            // do nothing;
        }
    });
    return obj;
}



var getStats = function () {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        var type = req.params.type;
        if (!type) {
            return next(new error.MissingParameterError({ required: 'type' }));
        }
        var queries;
        if (type==='all') {
            queries = stats.queries(req.params.range,req.params.scopeType, req.params.scopeId);
        } else {
            queries = {
                type: stats.queries(req.params.range,req.params.scopeType, req.params.scopeId)[type]
            };
        }


        var locals = {};

        async.forEach(_.keys(queries), function(queryName, done) {

            queries[queryName].exec(function (err, result) {
                if (err) { return error.handleError(err, done); }
                locals[queryName] = _replaceIdsByString(result);
                return done();
            });

        }, function(err) {
            if (err) {return error.handleError(err, next);}
            res.send([locals]);
            return next();
        });
    };
};

module.exports = {
    getStats: getStats
};