var mongoose = require('mongoose'),
    Model = mongoose.model('Recommendation'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/recommendations',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
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
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addGet({
        spec: {
            description: "Operations about recommendations",
            path: baseUrl,
            notes: "returns all recommendations, but limits to 100 entries by default, is not owner-constrained, e.g. it returns recommendations" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest recommendations",
            summary: "get all recommendations",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[Recommendation]",
            "nickname": "getRecommendations",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addPost({
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
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addDelete({
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
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addDelete({
            spec: {
                description: "Operations about recommendations",
                path: baseUrl,
                notes: "delete all recommendations",
                summary: "Deletes recommendations",
                method: "DELETE",
                "nickname": "deleteRecommendations",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};