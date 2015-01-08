var _ = require('lodash'),
    mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    error = require('ypbackendlib').error;


var cache = {};

// we try to replace for every property that is of type ObjectId - for every property of type Object or Array we call
// recursively
function _getValueFromCache(modelName, idToReplace, locale) {

    var cachedRepresentation = cache[modelName][idToReplace];

    if (!cachedRepresentation) {
        // we did not find a value with this id
        return null;
    } else if (_.isObject(cachedRepresentation)) {

        // the found cachedRepresentation is an object, the only valid reason for this is when we have an i18n property
        return cachedRepresentation[locale] || cachedRepresentation['de'];
    } else {

        // the found value is a simple value
        return cachedRepresentation;
    }
}


function replaceIdsByString(modelName) {

    cache[modelName] = {};
    return function (obj, options, cb) {

        // allows to override the replacing by the caller of the query
        if (options.dontReplaceIds) {
            return cb(null, obj, options);
        }

        var cacheMisses = [];

        // iterate through the object properties with type ObjecId
        // either replace the ObjectId by the cached value other put in the cacheMisses
        function _replaceFromCacheOnly() {
            var array = _.isArray(obj) ? obj : [obj];
            _.forEach(array, function (element) {
                _.forEach(element, function (propValue, propName) {
                    if (propValue instanceof ObjectId) {
                        var valFromCache = _getValueFromCache(modelName, propValue, options.locale);
                        if (valFromCache) {
                            element[propName] = valFromCache;
                        } else {
                            cacheMisses.push(propValue);
                        }
                    }
                });
            });
        }

        _replaceFromCacheOnly();

        if (cacheMisses.length > 0) {

            // we had some cacheMisses, need to load the missing elements into the cache
            // and redo the replacing for the missed ones.
            mongoose.model(modelName).find({_id: {$in: cacheMisses}}).exec(function (err, docs) {
                if (err) {
                    return cb(err);
                }

                _.forEach(docs, function (doc) {
                    cache[modelName][doc._id] = doc.getStatsString();
                });

                // reset the cacheMisses and try again, should have no cacheMisses now
                cacheMisses = [];
                _replaceFromCacheOnly();

                if (cacheMisses.length === 0) {
                    return cb(null, obj, options);
                } else {
                    throw new Error("should never arrive here, found unavailable ObjectId: " + cacheMisses);
                }
            });
        } else {
            return cb(null, obj, options);
        }
    };
}


function divideCountAttrByUserCount(obj, options, cb) {

    // we need to divide by the number of users to get the correct average.
    var queryClause = {};

    if (options.scopeType === 'campaign') {
        queryClause.campaign = new ObjectId(options.scopeId);
    } else if (options.scopeType === 'owner') {
        // we only have one persons count, just return
        return cb(null, obj, options);
    }
    mongoose.model('User').count(queryClause).exec(function (err, userCount) {
        if (err) {
            return error.handleError(err, cb);
        }
        if (userCount === 0) {
            // we have no users, so there is nothing
            return cb(null, obj, options);
        }
        var avgObj = _.map(obj, function (elem) {
            elem.count = elem.count / userCount;
            return elem;
        });

        return cb(null, avgObj, options);
    });
}

function addPercentagesOfRatingsCount(objs, options, cb) {
    var totalSumOfCount = _.reduce(objs, function (sum, obj) {
        if (obj.rating) {
            return sum + obj.count;
        } else {
            return sum;
        }
    }, 0);

    var percObjs = _.map(objs, function (elem) {
        elem.percentage = elem.count / totalSumOfCount;
        return elem;
    });
    return cb(null, percObjs, options);

}

module.exports = {
    replaceIds: replaceIdsByString,
    divideCountAttrByUserCount: divideCountAttrByUserCount,
    addPercentagesOfRatingsCount: addPercentagesOfRatingsCount
};
