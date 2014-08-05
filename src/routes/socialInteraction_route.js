var mongoose = require('mongoose'),
    Model = mongoose.model('SocialInteraction'),
    generic = require('./../handlers/generic'),
    handlers = require('../handlers/socialInteraction_handlers');

module.exports = function (swagger) {

    var baseUrl = '/socialInteractions',
        baseUrlWithId = baseUrl + '/{id}';

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
            accessLevel: 'al_individual'
        },
        action: handlers.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about socialInteractions",
            path: baseUrl,
            notes: "returns all socialInteractions, but limits to 100 entries by default. Use query params sort:'created:-1' and limit to retrieve the newest socialInteractions",
            summary: "get all socialInteractions",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[SocialInteraction]",
            "nickname": "getSocialInteractions",
            accessLevel: 'al_individual'
        },
        action: handlers.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
            spec: {
                description: "Operations about socialInteractions",
                path: baseUrlWithId,
                notes: "delete socialInteraction",
                summary: "Deletes a socialInteraction by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the socialInteraction to be fetched", "string")],
                "nickname": "deleteSocialInteraction",
                accessLevel: 'al_user'
            },
            action:  handlers.deleteByIdFn(baseUrl, Model)
        }
    );


};