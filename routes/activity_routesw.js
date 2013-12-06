/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    passport = require('passport'),
    genericHandlers = require('../handlers/generic'),
    handlers = require('../handlers/activity_handlers');


module.exports = function (swagger, config) {

    var baseUrl = '/activities';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl + '/recommendations',
            notes: "returns only the top 5 recommendations with their public attributes in normal case, ordered by recommendation weight. " +
                "If the authenticated user has role 'admin', all " +
                "attributes with all recommendations are returned (incl. all weights, ...)",
            summary: "returns the current top 5 recommendations for the authenticated user ",
            method: "GET",
            "responseClass": "ArrayOfRecommendations",
            "nickname": "getRecommendations",
            params: [
                {
                    paramType: "query",
                    name: "focus",
                    description: "the list of assessmentQuestions to be used as a focus when generating recommendations",
                    dataType: "ObjectId"
                }],
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: handlers.getRecommendationsFn
    });


    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns an activity based on id",
            params: [swagger.pathParam("id", "ID of the activity to be fetched", "ObjectId")],
            method: "GET",
            "responseClass": "Activity",
            "nickname": "getActivity",
            beforeCallbacks: [handlers.roleBasedAuth('anonymous')]
        },
        action: genericHandlers.getByIdFn(baseUrl, Activity)

    });

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns all activities",
            method: "GET",
            "responseClass": "Activity",
            "nickname": "getActivities",
            beforeCallbacks: [handlers.roleBasedAuth('anonymous')]
        },
        action: genericHandlers.getAllFn(baseUrl, Activity)

    });


    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "The new activity will get a number 'NEW' until, because we have not yet implemented an " +
                "autoincrement.",
            summary: "Posts a new activity",
            method: "POST",
            "responseClass": "Activity",
            "nickname": "postActivity",
            params: [
                {
                    paramType: "body",
                    name: "ActivityToStore",
                    description: "the activity to store",
                    dataType: "Activity"
                }],
            beforeCallbacks: [passport.authenticate('basic', { session: false }), handlers.invalidateActivityCache]
        },
        action: genericHandlers.postFn(baseUrl, Activity)
    });

    swagger.addPut({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "update an existing activity",
            summary: "Update an Activity",
            method: "PUT",
            "responseClass": "Activity",
            "nickname": "putActivity",
            params: [swagger.pathParam("id", "ID of the activity to be updated", "ObjectId")],
            beforeCallbacks: [passport.authenticate('basic', { session: false }), handlers.invalidateActivityCache]
        },
        action: genericHandlers.putFn(baseUrl, Activity)
    });

    swagger.addDelete({
        spec:{
            description: "Operations about Activities",
            path: baseUrl,
            notes: "deletes all activities",
            summary: "Deletes all Activities",
            method: "DELETE",
            "nickname": "deleteActivities",
            beforeCallbacks: [passport.authenticate('basic', { session: false }), handlers.invalidateActivityCache]
        },
        action: genericHandlers.deleteAllFn(baseUrl, Activity)
    });

 };