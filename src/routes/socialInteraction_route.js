var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('SocialInteraction'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/socialInteraction_handlers');

module.exports = function (swagger) {

    var baseUrl = '/socialInteractions',
        baseUrlWithId = baseUrl + '/{id}';
    var offersUrl = '/inspirations';

    swagger.addOperation({
        spec: {
            description: "Operations about socialInteractions",
            path: baseUrlWithId,
            notes: "update an existing socialInteraction",
            summary: "Update an socialInteraction",
            method: "PUT",
            mobileSDK: "disabled",
            "responseClass": "socialInteraction",
            "nickname": "putSocialInteraction",
            params: [swagger.pathParam("id", "ID of the socialInteraction to be updated", "string")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about socialInteractions",
            path: baseUrlWithId,
            notes: "returns a socialInteraction based on id",
            summary: "find socialInteraction by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the socialInteraction to be fetched", "string"),
                generic.params.populate],
            "responseClass": "SocialInteraction",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getSocialInteractionById",
            accessLevel: 'al_all'
        },
        action: handlers.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about socialInteractions",
            path: baseUrl,
            notes: "returns all socialInteractions that are targeted to this user",
            summary: "get all socialInteractions, supports generic filter, sort and populate options as well as custom filter options" +
                "admin mode: get all sois, invoked by role '[product,system]Admin' and queryParam mode='administrate'",
            method: "GET",
            params: [
                generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep,
                swagger.queryParam('dismissed', 'include socialInteractions that have been dismissed', 'Boolean', false, false),
                swagger.queryParam('rejected', 'include socialInteractions that have been rejected', 'Boolean', false, false),
                swagger.queryParam('authored', 'include socialInteractions where the user is the author', 'Boolean', false, false),
                swagger.queryParam('targetId', 'restrict to a targetId, for example an event or campaign, disables the default target space filter', 'String'),
                swagger.queryParam('publishFrom', 'filter by date if a valid date is provided, enable or disable date filter if it is a boolean value or not provided', 'String'),
                swagger.queryParam('publishTo', 'filter by date if a valid date is provided, enable or disable date filter if it is a boolean value or not provided', 'String'),
                swagger.queryParam('authorType', 'restrict to a authorType, for example only social interactions from a campaignlead', 'String'),
                swagger.queryParam('discriminators', 'comma separated list of discriminators / model names, for example "Invitation,Recommendation"', 'String'),
                swagger.queryParam('refDocId', 'restrict to a referenced document id', 'String'),
                swagger.queryParam('mode', 'expected values: [administrate]', 'String')
            ],
            "responseClass": "Array[SocialInteraction]",
            "nickname": "getSocialInteractions",
            accessLevel: 'al_individual'
        },
        action: handlers.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about socialInteractions",
            path: offersUrl,
            notes: "returns all offered Invitations and Recommendations that are targeted to this user, includes dismissed and rejected",
            summary: "get both recommendations and invitations for this user",
            method: "GET",
            params: [
                generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "Array[SocialInteraction]",
            "nickname": "getOffers",
            accessLevel: 'al_individual'
        },
        action: handlers.getOffers
    });

    swagger.addOperation({
            spec: {
                description: "Operations about socialInteractions",
                path: baseUrlWithId,
                notes: "delete socialInteraction",
                summary: "Deletes a socialInteraction by id",
                method: "DELETE",
                params: [
                    swagger.pathParam("id", "ID of the socialInteraction to be fetched", "string"),
                    swagger.queryParam('mode', 'expected values: [administrate]', 'String'),
                    swagger.queryParam('reason', 'the reason why the social interaction is dismissed, expected values: [eventScheduled eventJoined eventDeleted denied campaignleadAccepted orgadminAccepted]', 'String')
                ],
                "nickname": "deleteSocialInteraction",
                accessLevel: 'al_user'
            },
            action: handlers.deleteByIdFn(baseUrl, Model)
        }
    );


};