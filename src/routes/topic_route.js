var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('Topic'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    var baseUrl = '/topics',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about topics",
            path: baseUrlWithId,
            notes: "returns a topic based on id",
            summary: "find topic by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the topic to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Topic",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getTopicById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about topics",
            path: baseUrl,
            notes: "returns all topics, but limits to 100 entries by default, is not owner-constrained, e.g. it returns topics" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest topics",
            summary: "get all topics",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[Topic]",
            "nickname": "getTopics",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about topics",
            path: baseUrl,
            notes: "POSTs a new topic",
            summary: "POSTs a new topic",
            method: "POST",
            params: [swagger.bodyParam("Topic", "new Topic object", "Topic")],
            "responseClass": "Topic",
            "nickname": "postTopics",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about topics",
                path: baseUrlWithId,
                notes: "delete topic",
                summary: "Deletes a topic by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the topic to be fetched", "string")],
                "nickname": "deleteTopic",
                accessLevel: 'al_user'
            },
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about topics",
                path: baseUrl,
                notes: "delete all topics",
                summary: "Deletes topics",
                method: "DELETE",
                "nickname": "deleteTopics",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};