/**
 * User Routes module
 *    these routes require authenticated users
 */

var // passport = require('passport'),
    handlers = require('../handlers/stats_handlers'),
    common = require('./common');

// TODO: enable authentication for stats, not everyone should be able to get stats.
module.exports = function (swagger, config) {

    var baseUrl = '/stats';

    swagger.addGet({
        spec: {
            description: "Operations to get statistics ",
            path: baseUrl,
            notes: "",
            summary: "returns statistics depending on parameters passed to the API",
            method: "GET",
            nickname: "getStats",
            accessLevel: 'al_individual',
            params: [
                {
                    paramType: "query",
                    name: "type",
                    description: "the type of statistics to fetch",
                    dataType: "string",
                    enum: common.enums.statsType,
                    required: true
                },
                {
                    paramType: "query",
                    name: "scopeType",
                    description: "The type of the scope to which the stats should be constrained, can be used to get " +
                        "stats about a campaign or a specific user",
                    dataType: "string",
                    enum: ['all','campaign','owner'],
                    default: 'all'


                },
                {
                    paramType: "query",
                    name: "scopeId",
                    description: "The id of the scope to constrain the stats to, has to be a reference to a object" +
                        "of the suplied scopeType (user or campaign)",
                    dataType: "string"
                },
                {
                    paramType: "query",
                    name: "range",
                    description: "The timerange to constrain the stats to",
                    dataType: "string",
                    enum: ['day','week','month','year','all'],
                    default: 'all'
                }
            ]
        },
        action: handlers.getStats()
    });

};