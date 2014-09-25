var mongoose = require('mongoose'),
    Model = mongoose.model('Invitation'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/socialInteraction_handlers');

module.exports = function (swagger) {

    var baseUrl = '/invitations',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about invitations",
            path: baseUrlWithId,
            notes: "returns a invitation based on id",
            summary: "find invitation by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the invitation to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Invitation",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getInvitationById",
            accessLevel: 'al_individual'
        },
        action: handlers.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about invitations",
            path: baseUrl,
            notes: "returns all invitations, but limits to 100 entries by default, e.g. it returns invitations" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest invitations",
            summary: "get all invitations",
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
            "responseClass": "Array[Invitation]",
            "nickname": "getInvitations",
            accessLevel: 'al_individual'
        },
        action: handlers.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about invitations",
            path: baseUrl,
            notes: "POSTs a new invitation",
            summary: "POSTs a new invitation",
            method: "POST",
            params: [swagger.bodyParam("Invitation", "new Invitation object", "Invitation")],
            "responseClass": "Invitation",
            "nickname": "postInvitations",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );


    swagger.addOperation({
        spec: {
            description: "Operations about invitations",
            path: baseUrlWithId,
            notes: "update an existing invitation",
            summary: "Update an invitation",
            method: "PUT",
            mobileSDK: "disabled",
            "responseClass": "Invitation",
            "nickname": "putInvitation",
            params: [swagger.pathParam("id", "ID of the invitation to be updated", "string"), swagger.bodyParam("invitation", "invitation to be updated", "Idea")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Model)
    });

    swagger.addOperation({
            spec: {
                description: "Operations about invitations",
                path: baseUrlWithId,
                notes: "delete invitation",
                summary: "Deletes a invitation by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the invitation to be fetched", "string")],
                "nickname": "deleteInvitation",
                accessLevel: 'al_user'
            },
            action:  handlers.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about invitations",
                path: baseUrl,
                notes: "delete all invitations",
                summary: "Deletes invitations",
                method: "DELETE",
                "nickname": "deleteInvitations",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};