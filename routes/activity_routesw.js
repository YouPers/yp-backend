/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    passport = require('passport'),
    generic = require('../handlers/generic'),
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
            "responseClass": "Recommendation",
            "nickname": "getRecommendations",
            params: [
                {
                    paramType: "query",
                    name: "focus",
                    description: "the list of assessmentQuestions ObjectIds to be used as a focus when generating recommendations",
                    dataType: "ObjectId"
                },
                generic.params.limit,
                generic.params.populate
            ],
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: handlers.getRecommendationsFn
    });


    /**
     * need to add the Recommendation model here explicitly, because this is a transient class, that does not
     * exist in the database
     * TODO: (RBLU) Extract all these models into a single file and provide them to the Code that uses them and also to Swagger.
     *
     */
    swagger.addModels({
       Recommendation: {
           id: "Recommendation",
           required: ['activity'],
           type: "object",
           properties: {
               activity: {type: "Activity"},
               weight: {type: "double"}
           }
       }
    });

    swagger.addModels({
        ObjectId: {
            id: "ObjectId",
            required: ['id'],
            type: "object",
            properties: {
                id: {type: 'string'}
            }
        }
    });


    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns an activity based on id",
            params: [swagger.pathParam("id", "ID of the activity to be fetched", "ObjectId"),
                generic.params.populate],
            method: "GET",
            "responseClass": "Activity",
            "nickname": "getActivity",
            beforeCallbacks: [handlers.roleBasedAuth('anonymous')]
        },
        action: generic.getByIdFn(baseUrl, Activity)

    });

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns all activities",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Activity",
            "nickname": "getActivities",
            beforeCallbacks: [handlers.roleBasedAuth('anonymous')]
        },
        action: generic.getAllFn(baseUrl, Activity)
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
                }
            ],
            beforeCallbacks: [passport.authenticate('basic', { session: false }), handlers.invalidateActivityCache]
        },
        action: generic.postFn(baseUrl, Activity)
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
        action: generic.putFn(baseUrl, Activity)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "deletes all activities",
            summary: "Deletes all Activities",
            method: "DELETE",
            "nickname": "deleteActivities",
            beforeCallbacks: [passport.authenticate('basic', { session: false }), handlers.invalidateActivityCache]
        },
        action: generic.deleteAllFn(baseUrl, Activity)
    });

};