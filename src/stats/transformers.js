var _ = require('lodash'),
    async = require('async'),
    mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId,
    error = require('ypbackendlib').error;


var id2humanReadableString = {};
(function loadIdResolveCache() {
    var cachedModels = ['Idea', 'AssessmentQuestion'];

    async.forEach(cachedModels, function (modelName, done) {
        mongoose.model(modelName).find().exec(function (err, docs) {
            _.forEach(docs, function (doc) {
                id2humanReadableString[doc._id] = doc.getStatsString();
            });
            return done();
        });
    }, function (err) {
        if (err) {
            throw err;
        }

    });
}());

function replaceIdsByString(obj, options, cb) {
    _.forEach(obj, function (value, key) {
        if (_.isArray(value)) {
            replaceIdsByString(value, options);
        } else if (value instanceof ObjectId || value instanceof String) {
            var cachedRepresentation = id2humanReadableString[value];

            if (!cachedRepresentation) {
                obj[key] = value;
            } else if (_.isObject(cachedRepresentation)) {
                obj[key] = cachedRepresentation[options.locale] || cachedRepresentation['de'] || value;
            } else {
                obj[key] = id2humanReadableString[value] || value;
            }
        } else if (_.isObject(value)) {
            replaceIdsByString(value, options);

        } else {
            // do nothing;
        }
    });
    return cb ? cb(null, obj, options) : obj;
}


function divideCountAttrByUserCount (obj, options, cb) {

    // we need to divide by the number of users to get the correct average.
    var queryClause = {};

    if (options.scopeType === 'campaign') {
        queryClause.campaign = new ObjectId(options.scopeId);
    } else if (options.scopeType ===  'owner') {
        // we only have one persons count, just return
        return cb(null, obj, options);
    }
    mongoose.model('User').count(queryClause).exec(function (err, userCount) {
        if (err) {return error.handleError(err, cb);}
        if (userCount=== 0) {
            return cb(new Error("cannot have 0 count"));
        }
        var avgObj = _.map(obj, function(elem) {elem.count = elem.count/userCount; return elem;});

        return cb(null, avgObj, options);
    });
}

function addPercentagesOfRatingsCount (objs, options, cb) {
    var totalSumOfCount = _.reduce(objs, function(sum, obj) {
        if (obj.rating) {
            return sum + obj.count;
        } else {
            return sum;
        }
    }, 0);

    var percObjs =  _.map(objs, function(elem) {
        elem.percentage = elem.count/totalSumOfCount;
        return elem;
    });
    return cb(null, percObjs, options);

}

module.exports = {
    replaceIds: replaceIdsByString,
    divideCountAttrByUserCount: divideCountAttrByUserCount,
    addPercentagesOfRatingsCount: addPercentagesOfRatingsCount
};
