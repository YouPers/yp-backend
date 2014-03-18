/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    generic = require('../handlers/generic'),
    handlers = require('../handlers/activity_handlers');

module.exports = function (swagger, config) {

    var baseUrl = '/activities';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl + '/recommendations',
            notes: "returns only the top 10 recommendations with their public attributes in normal case, ordered by recommendation weight. " +
                "If the authenticated user has is an administrator, all " +
                "attributes with all recommendations are returned (incl. all weights, ...)",
            summary: "returns the current top 10 recommendations for the authenticated user ",
            method: "GET",
            "responseClass": "Recommendation",
            "nickname": "getRecommendations",
            params: [
                {
                    paramType: "query",
                    name: "focus",
                    description: "the list of assessmentQuestions strings to be used as a focus when generating recommendations",
                    dataType: "string"
                },
                generic.params.limit,
                generic.params.populate
            ],
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getRecommendationsFn
    });

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl + '/offers',
            notes: "returns the currently available activity offers and recommendations for the current user. The list consists " +
                "of activities recommended by the assessment evaluation, of campaign recommended activities and activityplans and of personal invitations.",
            summary: "returns the current top 10 actvity offers for the authenticated user.",
            method: "GET",
            "responseClass": "ActivityOffer",
            "nickname": "getActivityOffers",
            params: [
                generic.params.limit,
                generic.params.populate
            ],
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getActivityOffersFn
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




    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns an activity based on id",
            params: [swagger.pathParam("id", "ID of the activity to be fetched", "string"),
                generic.params.populate],
            method: "GET",
            "responseClass": "Activity",
            "nickname": "getActivity",
            accessLevel: 'al_all',
            beforeCallbacks: []
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
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: generic.getAllFn(baseUrl, Activity)
    });


    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "The new activity will get a number 'NEW' for product admins and 'NEW_C' for campaign leads, because we have not yet implemented an " +
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
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: handlers.postActivity
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
            params: [swagger.pathParam("id", "ID of the activity to be updated", "string")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: handlers.putActivity
    });

    swagger.addDelete({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "deletes all activities",
            summary: "Deletes all Activities",
            method: "DELETE",
            "nickname": "deleteActivities",
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteAllFn(baseUrl, Activity)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "deletes a specific activity",
            summary: "deletes a specific activity",
            method: "DELETE",
            "nickname": "deleteActivity",
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteByIdFn(baseUrl, Activity)
    });

};