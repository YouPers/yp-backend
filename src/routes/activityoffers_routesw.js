var generic = require('../handlers/generic'),
    handlers = require('../handlers/activityOffer_handlers'),
    ActivityOffer = require('mongoose').model('ActivityOffer');

module.exports = function (swagger, config) {

    var baseUrl = '/activityoffers';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrl + '/coach',
            notes: "returns the current coachRecommendations for a user",
            method: "GET",
            "responseClass": "Array[ActivityOffer]",
            "nickname": "getCoachRecommendations",
            params: [
                generic.params.limit,
                generic.params.populate
            ],
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getCoachRecommendationsFn
    });


    swagger.addGet({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrl,
            notes: "returns the currently available activity offers and recommendations for the current user. The list consists " +
                "of activities recommended by the assessment evaluation, of campaign recommended activities and activityplans and of personal invitations.",
            summary: "returns the current top 10 actvity offers for the authenticated user.",
            method: "GET",
            "responseClass": "Array[ActivityOffer]",
            "nickname": "getActivityOffers",
            params: [
                generic.params.limit,
                generic.params.populate
            ],
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: handlers.getActivityOffersFn
    });

    swagger.addGet({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrlWithId,
            notes: "returns one ActivityOffer by Id",
            method: "GET",
            "responseClass": "ActivityOffer",
            "nickname": "getActivityOfferById",
            params: [
	            swagger.pathParam("id", "ID of the activity to be fetched", "string"),
                generic.params.populatedeep
            ],
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getByIdFn(baseUrlWithId, ActivityOffer)
    });



    swagger.addPost({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrl,
            notes: "allows to post an activityOffer to promote an Activity to a targetAudience.",
            summary: "post an activityOffer",
            method: "POST",
            params: [swagger.bodyParam("ActivityOffer", "new ActivityOffer object", "ActivityOffer")],
            "nickname": "postActivityOffer",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postActivityOfferFn

    });


    swagger.addPut({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrlWithId,
            notes: "allows to update an activityOffer",
            summary: "put an activityOffer",
            method: "PUT",
            params: [swagger.pathParam("id", "the id of the activityOffer to update", "string"), swagger.bodyParam("ActivityOffer", "ActivityOffer to be updated", "ActivityOffer")],
            "responseClass": "ActivityOffer",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("activityOffer")],
            "nickname": "putActivityOffer",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.putActivityOfferFn

    });



    swagger.addDelete({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrl,
            notes: "deletes all ActivityOffers",
            summary: "Deletes all ActivityOffers",
            method: "DELETE",
            "nickname": "deleteActivityOffers",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteActivityOffersFn
    });

    swagger.addDelete({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrlWithId,
            notes: "deletes a specific ActivityOffers",
            summary: "deletes a specific ActivityOffers",
            method: "DELETE",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activityOffers to fetch ",
                    dataType: "string",
                    required: true
                }
            ],
            "nickname": "deleteActivityOffer",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteActivityOfferByIdFn
    });


};