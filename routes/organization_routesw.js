/**
 * Organization Routes module
 */

var mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    generic = require('./../handlers/generic'),
    organizationHandlers = require('./../handlers/organization_handlers.js');


module.exports = function (swagger, config) {

    var baseUrl = '/organizations',
        baseUrlWithId = baseUrl + "/{id}";


    swagger.addPost({
        spec: {
            description: "Create organization",
            path: baseUrl,
            notes: "creates an organization and assigns the authenticated user as administrator",
            summary: "creates an organization",
            method: "POST",
            params: [swagger.bodyParam("organization", "organization object", "Organization")],
            "responseClass": "Organization",
            "errorResponses": [],
            "nickname": "postOrganization",
            accessLevel: 'al_user'
        },
        action: organizationHandlers.postFn(baseUrl)
    });

    swagger.addGet({
        spec: {
            description: "Get organization",
            path: baseUrlWithId,
            notes: "returns a organization based on id",
            summary: "find organization by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the organization to be fetched", "string"),
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Organization",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("organization")],
            "nickname": "getOrganizationById",
            accessLevel: 'al_user'
        },
        action: generic.getByIdFn(baseUrl, Organization)
    });

    swagger.addGet({
        spec: {
            description: "Return all organizations administrated by the authenticated user",
            path: baseUrl,
            notes: "returns all organizations for the authenticated user",
            summary: "returns all organizations for the authenticated user",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Organization",
            "nickname": "getOrganizations",
            accessLevel: 'al_individual' // orgadmin's about to be need this check too
        },
        action: organizationHandlers.getAllForUserFn(baseUrl, Organization)
    });

    swagger.addDelete({
        spec: {
            description: "Delete organization",
            path: baseUrlWithId,
            notes: "deletes the organization with the passed id",
            summary: "deletes an organization",
            method: "DELETE",
            params: [swagger.pathParam("id", "ID of the organization to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("organization")],
            "nickname": "deleteOrganization",
            accessLevel: 'al_systemadmin'

        },
        action: generic.deleteByIdFn(baseUrl, Organization)
    });
};