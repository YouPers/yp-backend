var _ = require('lodash'),
    async = require('async'),
    mongoose = require('ypbackendlib').mongoose,
    ObjectId = mongoose.Types.ObjectId;


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

function _replaceIdsByString(obj, locale, cb) {
    _.forEach(obj, function (value, key) {
        if (_.isArray(value)) {
            _replaceIdsByString(value, locale);
        } else if (value instanceof ObjectId || value instanceof String) {
            var cachedRepresentation = id2humanReadableString[value];

            if (!cachedRepresentation) {
                obj[key] = value;
            } else if (_.isObject(cachedRepresentation)) {
                obj[key] = cachedRepresentation[locale] || cachedRepresentation['de'] || value;
            } else {
                obj[key] = id2humanReadableString[value] || value;
            }
        } else if (_.isObject(value)) {
            _replaceIdsByString(value, locale);

        } else {
            // do nothing;
        }
    });
    return cb ? cb(null, obj, locale) : obj;
}

module.exports = {
    replaceIds: _replaceIdsByString
};
