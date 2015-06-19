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
                    description: "boolean flag to include the stats for this goal into the result, will add properties: 'thisPeriod' and 'lastPeriod' to the goal objects",
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

    swagger.addOperation({
        spec: {
            description: "Operations about Goals",
            path: baseUrlWithId,
            notes: "DELETEs a goal by id, is not actually deleting the goal, but marking as ended by stetting goal.end = now(), use the realdelete=true queryparam to really delete a goal",
            summary: "marks the goal as deleted by setting an end date",
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
                    name: "realdelete",
                    description: "boolean flag to indicate that the goal should be deleted from the database",
                    dataType: "boolean",
                    required: false
                }
            ],
            method: "DELETE",
            nickname: "deleteGoal",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: goalHandlers.deleteGoalById
    });

    routes.addGenericRoutes(swagger, mongoose.model('Goal'), baseUrl, {GET: false, GETall: false, DELETE: false});

};