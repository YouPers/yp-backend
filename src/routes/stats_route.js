    var handlers = require('../handlers/stats_handlers');
    var statsQueries = require('../stats/statsQueries');
    var _ = require('lodash');


// TODO: enable authentication for stats, not everyone should be able to get stats.
module.exports = function (swagger) {

    var baseUrl = '/stats';

    swagger.addOperation({
        spec: {
            description: "Operations to get statistics ",
            path: baseUrl,
            notes: "",
            summary: "returns statistics depending on parameters passed to the API",
            method: "GET",
            nickname: "getStats",
            accessLevel: 'al_individual',
            responseClass: 'string',
            params: [
                {
                    paramType: "query",
                    name: "type",
                    description: "the type of statistics to fetch",
                    dataType: "string",
                    enum: _.keys(statsQueries).concat(['all']),
                    required: true
                },
                {
                    paramType: "query",
                    name: "scopeType",
                    description: "The type of the scope to which the stats should be constrained, can be used to get " +
                        "stats about a campaign or a specific user, or a topic",
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