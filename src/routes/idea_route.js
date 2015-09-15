/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
    Idea = mongoose.model('Idea'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/idea_handlers'),
    config = require('../config/config');

module.exports = function (swagger) {

    var baseUrl = '/ideas';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns an idea based on id",
            params: [swagger.pathParam("id", "ID of the idea to be fetched", "string"),
                generic.params.populate],
            method: "GET",
            "responseClass": "Idea",
            "nickname": "getIdea",
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: generic.getByIdFn(baseUrl, Idea, null, config)

    });

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId + '/defaultEvent',
            notes: "returns the default event template for this idea",
            summary: "returns the default event template for this idea",
            params: [
                swagger.pathParam("id", "ID of the idea to be fetched", "string"),
                swagger.queryParam('campaignId', 'optional campaignId used by campaignLead, defaults to the campaign of the authenticated user', 'String'),
                generic.params.populate],
            method: "GET",
            "responseClass": "Event",
            "nickname": "getDefaultEvent",
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: handlers.getDefaultEvent

    });

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrl,
            notes: "returns only the public attributes in normal case. If the authenticated user has role 'admin', all " +
                "attributes are returned (incl. all recWeights, ...)",
            summary: "returns all ideas",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Array[Idea]",
            "nickname": "getIdeas",
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: handlers.getAllIdeas(baseUrl, Idea, null, config)
    });


    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrl,
            notes: "The new idea will get a number 'NEW' for product admins and 'NEW_C' for campaign leads, because we have not yet implemented an " +
                "autoincrement.",
            summary: "Posts a new event",
            method: "POST",
            mobileSDK: "disabled",
            "responseClass": "Idea",
            "nickname": "postIdea",
            params: [
                {
                    paramType: "body",
                    name: "IdeaToStore",
                    description: "the idea to store",
                    dataType: "Idea"
                }
            ],
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: handlers.postIdea
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId,
            notes: "update an existing event",
            summary: "Update an Idea",
            method: "PUT",
            mobileSDK: "disabled",
            "responseClass": "Idea",
            "nickname": "putIdea",
            params: [swagger.pathParam("id", "ID of the idea to be updated", "string"), swagger.bodyParam("idea", "idea to be updated", "Idea")],
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: handlers.putIdea
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrl,
            notes: "deletes all ideas",
            summary: "Deletes all Ideas",
            method: "DELETE",
            mobileSDK: "disabled",
            "nickname": "deleteIdeas",
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteAllFn(baseUrl, Idea)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId,
            notes: "deletes a specific event",
            summary: "deletes a specific event",
            method: "DELETE",
            mobileSDK: "disabled",
            "nickname": "deleteIdea",
            params: [swagger.pathParam("id", "ID of the idea to be deleted", "string")],
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteByIdFn(baseUrl, Idea)
    });

};