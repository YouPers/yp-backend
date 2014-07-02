/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Idea = mongoose.model('Idea'),
    generic = require('../handlers/generic'),
    handlers = require('../handlers/idea_handlers');

module.exports = function (swagger, config) {

    var baseUrl = '/ideas';
    var baseUrlWithId = baseUrl + '/{id}';

    /**
     * need to add the Recommendation model here explicitly, because this is a transient class, that does not
     * exist in the database
     * TODO: (RBLU) Extract all these models into a single file and provide them to the Code that uses them and also to Swagger.
     *
     */
    swagger.addModels({
       Recommendation: {
           id: "Recommendation",
           required: ['idea'],
           type: "object",
           properties: {
               idea: {type: "Idea"},
               weight: {type: "double"}
           }
       }
    });

    swagger.addGet({
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
        action: generic.getByIdFn(baseUrl, Idea)

    });

    swagger.addGet({
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
        action: handlers.getAllIdeas(baseUrl, Idea)
    });


    swagger.addPost({
        spec: {
            description: "Operations about Ideas",
            path: baseUrl,
            notes: "The new idea will get a number 'NEW' for product admins and 'NEW_C' for campaign leads, because we have not yet implemented an " +
                "autoincrement.",
            summary: "Posts a new activity",
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

    swagger.addPut({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId,
            notes: "update an existing activity",
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

    swagger.addDelete({
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

    swagger.addDelete({
        spec: {
            description: "Operations about Ideas",
            path: baseUrlWithId,
            notes: "deletes a specific activity",
            summary: "deletes a specific activity",
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