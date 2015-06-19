/**
 * Goals Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
    generic = require('ypbackendlib').handlers,
    goalHandlers = require('../handlers/goal_handlers'),
    routes = require('ypbackendlib').routes;


module.exports = function (swagger) {

    var baseUrl = '/goals';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about Goals",
            path: baseUrlWithId,
            notes: "Returns a user's goal by id, allows to include the stats for this and last period with query param stats=true",
            summary: "Returns a user's goal by id",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the event to fetch ",
                    dataType: "string",
                    required: true
                },
                {
                    paramType: "query",
                    name: "stats",
                    description: "boolean flag to include the stats for this goal into the result, will add properties: 'thisPeriod' and 'lastPeriod' to the goal objects",
                    dataType: "boolean",
                    required: false
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            method: "GET",
            nickname: "getGoal",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: goalHandlers.getGoalById
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Goals",
            path: baseUrl,
            notes: "Returns all user's goals, allows to include the stats for this and last period with query param stats=true, will add properties: 'thisPeriod' and 'lastPeriod' to the goal objects",
            summary: "Returns all user's goal",
            params: [
                {
                    paramType: "query",
                    name: "stats",
                    description: "boolean flag to include the stats for this goal into the result",
                    dataType: "boolean",
                    required: false
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            method: "GET",
            nickname: "getGoals",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: goalHandlers.getGoals
    });

    routes.addGenericRoutes(swagger, mongoose.model('Goal'), baseUrl, {GET: false, GETall: false});

};