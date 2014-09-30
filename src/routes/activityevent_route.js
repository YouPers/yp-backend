var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('ActivityEvent'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    var baseUrl = '/activityevents',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about activityEvents",
            path: baseUrlWithId,
            notes: "returns a activityEvent based on id",
            summary: "find activityEvent by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the activityEvent to be fetched", "string"),
                generic.params.populate],
            "responseClass": "ActivityEvent",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getActivityEventById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about activityEvents",
            path: baseUrl,
            notes: "returns all activityEvents, but limits to 100 entries by default, is not owner-constrained, e.g. it returns activityEvents" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest activityEvents",
            summary: "get all activityEvents",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[ActivityEvent]",
            "nickname": "getActivityEvents",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about activityEvents",
            path: baseUrl,
            notes: "POSTs a new activityEvent",
            summary: "POSTs a new activityEvent",
            method: "POST",
            params: [swagger.bodyParam("ActivityEvent", "new ActivityEvent object", "ActivityEvent")],
            "responseClass": "ActivityEvent",
            "nickname": "postActivityEvent",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about activityEvents",
                path: baseUrlWithId,
                notes: "PUTs a new activityEvent",
                summary: "PUTs a new activityEvent",
                method: "PUT",
                params: [swagger.bodyParam("ActivityEvent", "new ActivityEvent object", "ActivityEvent")],
                "responseClass": "ActivityEvent",
                "nickname": "putActivityEvent",
                accessLevel: 'al_individual'
            },
            action:  generic.putFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about activityEvents",
                path: baseUrlWithId,
                notes: "delete activityEvent",
                summary: "Deletes a activityEvent by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the activityEvent to be deleted", "string")],
                "nickname": "deleteActivityEvent",
                accessLevel: 'al_user'
            },
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about activityEvents",
                path: baseUrl,
                notes: "delete all activityEvents",
                summary: "Deletes activityEvents",
                method: "DELETE",
                "nickname": "deleteActivityEvents",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );
};