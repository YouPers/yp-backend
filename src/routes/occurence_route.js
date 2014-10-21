var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('Occurence'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    var baseUrl = '/occurences',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about occurences",
            path: baseUrlWithId,
            notes: "returns a occurence based on id",
            summary: "find occurence by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the occurence to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Occurence",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getOccurenceById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about occurences",
            path: baseUrl,
            notes: "returns all occurences, but limits to 100 entries by default, is not owner-constrained, e.g. it returns occurences" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest occurences",
            summary: "get all occurences",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[Occurence]",
            "nickname": "getOccurences",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about occurences",
            path: baseUrl,
            notes: "POSTs a new occurence",
            summary: "POSTs a new occurence",
            method: "POST",
            params: [swagger.bodyParam("Occurence", "new Occurence object", "Occurence")],
            "responseClass": "Occurence",
            "nickname": "postOccurence",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about occurences",
                path: baseUrlWithId,
                notes: "PUTs a new occurence",
                summary: "PUTs a new occurence",
                method: "PUT",
                params: [swagger.bodyParam("Occurence", "new Occurence object", "Occurence")],
                "responseClass": "Occurence",
                "nickname": "putOccurence",
                accessLevel: 'al_individual'
            },
            action:  generic.putFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about occurences",
                path: baseUrlWithId,
                notes: "delete occurence",
                summary: "Deletes a occurence by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the occurence to be deleted", "string")],
                "nickname": "deleteOccurence",
                accessLevel: 'al_user'
            },
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about occurences",
                path: baseUrl,
                notes: "delete all occurences",
                summary: "Deletes occurences",
                method: "DELETE",
                "nickname": "deleteOccurences",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );
};