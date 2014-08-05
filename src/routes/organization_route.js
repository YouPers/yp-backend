/**
 * Organization Routes module
 */

var mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    generic = require('./../handlers/generic'),
    organizationHandlers = require('./../handlers/organization_handlers.js');


module.exports = function (swagger) {

    var baseUrl = '/organizations',
        baseUrlWithId = baseUrl + "/{id}";


    swagger.addOperation({
        spec: {
            description: "avatar image upload",
            path: baseUrlWithId + "/avatar",
            summary: "avatar image upload",
            method: "POST",
            "nickname": "avatarImagePost",
            accessLevel: 'al_orgadmin'
        },
        action: organizationHandlers.avatarImagePostFn(baseUrl)
    });

    swagger.addOperation({
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
    swagger.addOperation({
        spec: {
            description: "Update organization",
            path: baseUrlWithId,
            notes: "updates an organization",
            summary: "updates an organization",
            method: "PUT",
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
            params: [swagger.pathParam("id", "ID of the organization to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("organization")],
            "nickname": "deleteOrganization",
            accessLevel: 'al_systemadmin'

        },
        action: generic.deleteByIdFn(baseUrl, Organization)
    });
    swagger.addOperation({
        spec: {
            description: "Invite an organization administrator",
            path: baseUrlWithId + "/inviteOrganizationAdminEmail",
            notes: "Posts a request for an invitation for one or more email-addresses",
            summary: "Request an invitation for to become organization admin to be sent by the backend to the supplied email address(es)",
            params: [
                {
                    paramType: "body",
                    name: "email",
                    description: "object with one property: 'email', an email address, or an array of adresses, or a separated String of emails (by ';, ')",
                    dataType: "EmailObject",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "postOrganizationAdminInvite",
            accessLevel: 'al_orgadmin',
            beforeCallbacks: []
        },
        action: organizationHandlers.postOrganizationAdminInviteFn
    });

    swagger.addOperation({
        spec: {
            description: "Assign a organization admin",
            path: baseUrlWithId + "/assignOrganizationAdmin",
            notes: "Posts a request to add the current user as orgadmin for the organization: special endpoint that can be called without al_orgadmin but needs a token instead for auth",
            summary: "With this endpoint a non-privileged user can assign himself to become organization admin when he has an invitation token.",
            params: [
                {
                    paramType: "query",
                    name: "token",
                    description: "the authtoken the user has gotten with his invitation email",
                    dataType: "string",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "assignOrganizationAdmin",
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: organizationHandlers.assignOrganizationAdminFn
    });

};