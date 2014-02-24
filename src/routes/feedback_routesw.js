/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    common = require('./common'),
    http = require("http"),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions);


module.exports = function (swagger, config) {

    var baseUrl = '/feedback';


    swagger.addPost({
        spec: {
            description: "Post feedback",
            path: baseUrl,
            notes: "creates an JIRA issue for the posted feedback",
            summary: "Post feedback",
            method: "POST",
            params: [swagger.bodyParam("feedback", "feedback object", "Feedback")],
            "responseClass": "Campaign",
            "errorResponses": [],
            "nickname": "postFeedback",
            accessLevel: 'al_all'
        },
        action: function (req, res, next) {

            var options = {
                host: 'youpers.atlassian.net',
                path: '/rest/api/latest/issue/',
                method: 'POST',
                port: 443
            };

            var request = http.request(options, function(response) {
                response.on('data', function (chunk) {
                    log.debug("feedback response", chunk);
                });

                response.on('end', function () {
                    next();
                });
            });


            request.write({
                "fields": {
                    "project":
                    {
                        "key": "eWorkLife"
                    },
                    "summary": "REST ye merry gentlemen.",
                    "description": "Creating of an issue using project keys and issue type names using the REST API",
                    "issuetype": {
                        "name": "Bug"
                    }
                }
            });

        }
    });

};