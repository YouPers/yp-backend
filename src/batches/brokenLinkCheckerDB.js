var mongoose = require('ypbackendlib').mongoose,
    request = require('request'),
    async = require('async'),
    _ = require('lodash'),
    batch = require('ypbackendlib').batch,
    config = require('../config/config'),
    urlComposer = require('../util/urlcomposer');

var fieldNames = {
    Idea: ['description', 'text'],
    Topic: ['shortDescription', 'text'],
    AssessmentQuestion: ['exptext', 'mintextexample', 'mintextresult', 'midtextexample', 'midtextresult', 'maxtextexample', 'maxtextresult']
};

// this pattern should be sufficient, but the perfect regular expression for a URL is a science in itself
var urlPattern = 'https?:\\/\\/([-a-zA-Z0-9@:%._\\+~#=]{2,256}\\.)?[-a-zA-Z0-9@:%._\\+~#=]{2,256}\\.[a-z]{2,6}\\b[-a-zA-Z0-9@:%_\\+.,~#?&//=]*';
var languages = ['de', 'en'];

function checkLink(link, cb) {

    var log = this.log;

    log.debug({ link: link }, 'checking link');
    var start = new Date();

    request.head(link, function (err, res, body) {


        if(err || res.statusCode === 405) {

            request.get(link, function (err, res, body) {
                if(err) {
                    log.error(err, 'error while checking link');
                    return cb(null, { status: err.toString(), link: link, headers: res.headers });
                }

                log.debug({code: res.statusCode, duration: new Date () - start}, 'got result: ' + link);
                return cb(null, { status: res.statusCode, link: link, headers: res.headers });
            });

        } else {
            log.debug({code: res.statusCode, duration: new Date () - start}, 'got result: ' + link);
            return cb(null, { status: res.statusCode, link: link, headers: res.headers });
        }
    });

}

/**
 * worker function
 *
 * @param workItem
 * @param done
 * @param context
 */
var checkLinks = function checkLinks(workItem, done, context) {
    var log = (context && context.log) || this.log;
    var i18n = (context && context.i18n) || this.i18n;

    if (!log || !i18n) {
        throw new Error('missing log and i18n: must be present either in "this" or in the passed context object');
    }

    var modelName = workItem.constructor.modelName;

    log.debug('checking links for workItem ' + modelName + ':' + workItem.id);

    var links = [];

    _.each(fieldNames[modelName], function (fieldName) {
        return _.each(languages, function (language) {

            var value = workItem[fieldName+'I18n'][language],
                regex = new RegExp(urlPattern, 'g'),
                match;

            // find all links in this value
            while((match = regex.exec(value)) !== null) {
                links.push(match[0]);
            }
        });
    });

    async.map(_.uniq(links), checkLink.bind(this), function (err, results) {


        if(err) {
            return done(err);
        }

        // broken links are a non 2xx response status
        var brokenLinks = _.filter(results, function (result) {
            return typeof result.status !== 'number' ||
                result.status < 200 || result.status >=300 ;
        });

        var editLink;
        switch(modelName) {
            case 'Idea':
                editLink = urlComposer.adminEditIdea(workItem.id);
                break;
            case 'AssessmentQuestion':
                // TODO: deep links for assessment by topicId
                editLink = urlComposer.adminEditAssessments();
                break;

            // no edit frontend for Topic documents available
        }

        // explicitly return false if no brokenLinks are found to exclude the workItem from reporting
        if(!brokenLinks || brokenLinks.length === 0) {
            done(err, false);
        } else {
            done(err, {
                edit: editLink,
                result: brokenLinks
            });
        }


    });

};

var feeder = function (callback) {

    /**
     * creates a query that matches all documents containing a URL
     * - in any of the specified fields,
     * - in any of the configured languages
     *
     * @param fieldNames - without the 'I18n' suffix
     */
    function createQuery(fieldNames) {
        var or = [];
        _.each(fieldNames, function (fieldName) {
            _.each(languages, function (language) {
                var query = {};
                query[fieldName + 'I18n' + '.' + language] = { $regex: new RegExp(urlPattern) };
                or.push(query);
            });
        });
        return {$or: or};
    }

    var limit = 0; // 0 = disabled, only set for testing

    var Idea = mongoose.model('Idea'),
        Topic = mongoose.model('Topic'),
        AssessmentQuestion = mongoose.model('AssessmentQuestion');

    async.parallel([
        function (cb) {
            Idea.find(createQuery(fieldNames.Idea)).limit(limit).exec(cb); },
        function (cb) { Topic.find(createQuery(fieldNames.Topic)).limit(limit).exec(cb); },
        function (cb) { AssessmentQuestion.find(createQuery(fieldNames.AssessmentQuestion)).limit(limit).exec(cb); }
    ], function(err, results) {
        callback(err, _.flatten(results));
    });


};

var worker = function (workItem, done) {
    return checkLinks.apply(this, [workItem, done]);
};

var run = function run() {
    require('../util/database').initializeDb();
    this.config = config;
    this.log = require('ypbackendlib').log(config);
    batch.genericBatch(feeder, worker, this);
};

module.exports = {
    run: run,
    feeder: feeder,
    urlPattern: urlPattern,
    checkLink: checkLink
};