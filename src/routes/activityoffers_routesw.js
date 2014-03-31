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
            "responseClass": "ActivityOffer",
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

    swagger.addGet({
        spec: {
            description: "Operations about ActivityOffers",
            path: baseUrlWithId,
            notes: "returns one ActivityOffer by Id",
            method: "GET",
            "responseClass": "ActivityOffer",
            "nickname": "getActivityOfferById",
            params: [
                generic.params.limit,
                generic.params.populate
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
            "nickname": "postActivityOffer",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postActivityOfferFn

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
            "nickname": "deleteActivityOffer",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.deleteByIdFn(baseUrl, ActivityOffer)
    });


};