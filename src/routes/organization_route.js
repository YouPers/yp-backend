/**
 * Organization Routes module
 */

var mongoose = require('ypbackendlib').mongoose,
    Organization = mongoose.model('Organization'),
    generic = require('ypbackendlib').handlers,
    organizationHandlers = require('./../handlers/organization_handlers.js');


module.exports = function (swagger) {

    var baseUrl = '/organizations',
        baseUrlWithId = baseUrl + "/{id}";

    swagger.addOperation({
        spec: {
            description: "Create organization",
            path: baseUrl,
            notes: "creates an organization and assigns the authenticated user as administrator",
            summary: "creates an organization",
            method: "POST",
            hidden: "true",
            params: [swagger.bodyParam("organization", "organization object", "Organization")],
            "responseClass": "Organization",
            "errorResponses": [],
            "nickname": "postOrganization",
            accessLevel: 'al_user'
        },
        action: organizationHandlers.postFn(baseUrl)
    });
    swagger.addOperation({
        spec: {
            description: "Update organization",
            path: baseUrlWithId,
            notes: "updates an organization",
            summary: "updates an organization",
            method: "PUT",
            hidden: "true",
            params: [swagger.pathParam("id", "ID of the organization to be updated", "string"), swagger.bodyParam("organization", "organization object", "Organization")],
            "responseClass": "Organization",
            "errorResponses": [],
            "nickname": "putOrganization",
            accessLevel: 'al_orgadmin'
        },
        action: generic.putFn(baseUrlWithId, Organization)
    });

    swagger.addOperation({
        spec: {
            description: "Get organization",
            path: baseUrlWithId,
            notes: "returns a organization based on id",
            summary: "find organization by id",
            method: "GET",
            hidden: "true",
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

    swagger.addOperation({
        spec: {
            description: "Return all organizations administrated by the authenticated user",
            path: baseUrl,
            notes: "returns all organizations for the authenticated user",
            summary: "returns all organizations for the authenticated user",
            hidden: "true",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Array[Organization]",
            "nickname": "getOrganizations",
            accessLevel: 'al_user' // orgadmin's about to be need this check too
        },
        action: organizationHandlers.getAllForUserFn
    });

    swagger.addOperation({
        spec: {
            description: "Delete organization",
            path: baseUrlWithId,
            notes: "deletes the organization with the passed id",
            summary: "deletes an organization",
            method: "DELETE",
            hidden: "true",
            params: [swagger.pathParam("id", "ID of the organization to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("organization")],
            "nickname": "deleteOrganization",
            accessLevel: 'al_systemadmin'

        },
        action: generic.deleteByIdFn(baseUrl, Organization)
    });
};