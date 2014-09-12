var mongoose = require('mongoose'),
    Model = mongoose.model('Message'),
    generic = require('./../handlers/generic'),
    handlers = require('../handlers/socialInteraction_handlers');

module.exports = function (swagger) {

    var baseUrl = '/messages',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about messages",
            path: baseUrlWithId,
            notes: "returns a message based on id",
            summary: "find message by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the message to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Message",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getMessageById",
            accessLevel: 'al_individual'
        },
        action: handlers.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about messages",
            path: baseUrl,
            notes: "returns all messages, but limits to 100 entries by default, is not owner-constrained, e.g. it returns messages" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest messages",
            summary: "get all messages",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep,
                swagger.queryParam('administrate', 'flag for admin user to indicate he is acting as an administrator currently',
                    'Boolean', false, false),
                swagger.queryParam('campaign', 'the campaignId to be used as filter for a campaignlead to get all sois for a campaign to administrate',
                    'Boolean', false, false)
            ],
            "responseClass": "Array[Message]",
            "nickname": "getMessages",
            accessLevel: 'al_individual'
        },
        action: handlers.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about messages",
            path: baseUrl,
            notes: "POSTs a new message",
            summary: "POSTs a new message",
            method: "POST",
            params: [swagger.bodyParam("Message", "new Message object", "Message")],
            "responseClass": "Message",
            "nickname": "postMessages",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
        spec: {
            description: "Operations about messages",
            path: baseUrlWithId,
            notes: "update an existing message",
            summary: "Update an message",
            method: "PUT",
            mobileSDK: "disabled",
            "responseClass": "Message",
            "nickname": "putMessage",
            params: [swagger.pathParam("id", "ID of the message to be updated", "string"), swagger.bodyParam("message", "message to be updated", "Idea")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Model)
    });
    
    swagger.addOperation({
            spec: {
                description: "Operations about messages",
                path: baseUrlWithId,
                notes: "delete message",
                summary: "Deletes a message by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the message to be fetched", "string")],
                "nickname": "deleteMessage",
                accessLevel: 'al_user'
            },
            action:  handlers.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about messages",
                path: baseUrl,
                notes: "delete all messages",
                summary: "Deletes messages",
                method: "DELETE",
                "nickname": "deleteMessages",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};