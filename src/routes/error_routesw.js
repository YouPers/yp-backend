/**
 * Error Routes module
 *    log errors posted by the client
 */

var restify = require("restify"),
    env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    error = require('../util/error');


module.exports = function (swagger, config) {

    var baseUrl = '/error';


    swagger.addPost({
        spec: {
            description: "Post errors",
            path: baseUrl,
            notes: "log errors posted by the client",
            summary: "Post errors",
            method: "POST",
            params: [swagger.bodyParam("error", "error object", "Error")],
            responseClass: "Error",
            errorResponses: [],
            nickname: "postError",
            accessLevel: "al_all"
        },
        action: function (req, res, next) {

            if(!req.body) {
                next(new error.MissingParameterError({ required: 'error object'}));
            }

            var error = req.body;

            log.error(error);

        }
    });

};