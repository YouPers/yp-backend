var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('Recommendation'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/socialInteraction_handlers');

module.exports = function (swagger) {

    var baseUrl = '/recommendations',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about recommendations",
            path: baseUrlWithId,
            notes: "returns a recommendation based on id",
            summary: "find recommendation by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the recommendation to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Recommendation",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getRecommendationById",
            accessLevel: 'al_individual'
        },
        action: handlers.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about recommendations",
            path: baseUrl,
            notes: "returns all recommendations that are relevant for this user. Use query params sort:'created:-1' and limit to retrieve the newest recommendations",
            summary: "get all recommendations",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep,
                swagger.queryParam('administrate', 'flag for admin user to indicate he is acting as an administrator currently',
                    'Boolean', false, false),
                swagger.queryParam('campaign', 'the campaignId to be used as filter for a campaignlead to get all sois for a campaign to administrate',
                    'ObjectId', false, false)
            ],
            "responseClass": "Array[Recommendation]",
            "nickname": "getRecommendations",
            accessLevel: 'al_individual'
        },
        action: handlers.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
            spec: {
                description: "Operations about recommendations",
                path: baseUrl,
                notes: "POSTs a new recommendation",
                summary: "POSTs a new recommendation",
                method: "POST",
                params: [swagger.bodyParam("Recommendation", "new Recommendation object", "Recommendation")],
                "responseClass": "Recommendation",
                "nickname": "postRecommendations",
                accessLevel: 'al_individual'
            },
            action: generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
        spec: {
            description: "Operations about recommendations",
            path: baseUrlWithId,
            notes: "update an existing recommendation",
            summary: "Update an recommendation",
            method: "PUT",
            mobileSDK: "disabled",
            "responseClass": "Recommendation",
            "nickname": "putRecommendation",
            params: [swagger.pathParam("id", "ID of the recommendation to be updated", "string"), swagger.bodyParam("recommendation", "recommendation to be updated", "Idea")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Model)
    });
    
    swagger.addOperation({
            spec: {
                description: "Operations about recommendations",
                path: baseUrlWithId,
                notes: "delete recommendation",
                summary: "Deletes a recommendation by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the recommendation to be fetched", "string")],
                "nickname": "deleteRecommendation",
                accessLevel: 'al_user'
            },
            action: handlers.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about recommendations",
                path: baseUrl,
                notes: "delete all recommendations",
                summary: "Deletes recommendations",
                method: "DELETE",
                "nickname": "deleteRecommendations",
                accessLevel: 'al_admin'
            },
            action: generic.deleteAllFn(baseUrl, Model)
        }
    );

};