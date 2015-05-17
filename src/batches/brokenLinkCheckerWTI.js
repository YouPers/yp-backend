var async = require('async'),
    _ = require('lodash'),
    batch = require('ypbackendlib').batch,
    config = require('../config/config'),
    request = require('request-json');

var brokenLinkCheckerDB = require('./brokenLinkCheckerDB');
var urlPattern = brokenLinkCheckerDB.urlPattern;

//var wtiProjectId = '8233-eWL';
var wtiApiUrl = 'https://webtranslateit.com/';
var wtiProjectKey = '8lfoHUymg_X8XETa_uLaHg';

var wtiProjectPath = '/api/projects/' + wtiProjectKey;


var jsonClient = request.createClient(wtiApiUrl);


/**
 * worker function
 *
 * @param workItem - { translationKey, links }
 * @param done
 * @param context
 */
var checkLinks = function checkLinks(workItem, done, context) {
    var log = (context && context.log) || this.log;
    var i18n = (context && context.i18n) || this.i18n;

    if (!log || !i18n) {
        throw new Error('missing log and i18n: must be present either in "this" or in the passed context object');
    }

    log.info('checking links for WTI key ' + workItem.workItemId);

    async.map(workItem.links, brokenLinkCheckerDB.checkLink.bind(this), function (err, results) {


        if(err) {
            return done(err);
        }

        var brokenLinks = _.filter(results, function (result) {
            return typeof result.status !== 'number' ||
                result.status >= 400 && result.status <= 499 ;
        });


        // explicitly return false if no brokenLinks are found to exclude the workItem from reporting
        if(!brokenLinks || brokenLinks.length === 0) {
            done(err, false);
        } else {
            done(err, {
                // TODO: creation of edit link not possible yet, we have to refactor the feeder and retrieve paginated strings instead of files in order to create the link to edit the translation at WTI
                // editLink:
                result: brokenLinks
            });
        }


    });

};

var feeder = function (callback) {

    var log = this.log;

    jsonClient.get(wtiProjectPath + '.json', function(err, res, body) {

        if(err) {
            return log.error('error retrieving wti project', err);
        }

        var workItems = [];

        async.each(body.project.project_files, function (projectFile, cb) {

            var filePath = wtiProjectPath + '/files/...?file_path=' + projectFile.name;

            jsonClient.get(filePath, function (err, res, body) {

                if(err) {
                    return cb(err);
                }

                /**
                 * recursively search for translation values in an object, and store them in workItems,
                 * concatenate the translation key in dot-notation using the path parameter
                 */
                function getTranslations(obj, path) {
                    _.each(obj, function (value, key) {
                        if(typeof value === 'object') {
                            getTranslations(value, key);
                        } else if(typeof value === 'string') {

                            // TODO: use .exec instead of .match in order to distinguish between matches and capture groups, needed to support multiple matches per workItem
                            var match = value.match(urlPattern);

                            if(match) {
                                // store
                                workItems.push({
                                    workItemId: path + '.' + key,
                                    links: [match[0]]
                                });
                            }

                        } else {
                            throw new Error("unexpected value: " + value);
                        }
                    });
                }

                getTranslations(body);

                cb(err);

            });

        }, function (err) {

            callback(err, workItems);
        });

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
    feeder: feeder
};