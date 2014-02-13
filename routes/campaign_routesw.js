/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Campaign = mongoose.model('Campaign'),
    genericHandlers = require('./../handlers/generic'),
    campaignHandlers = require('./../handlers/campaign_handlers');


module.exports = function (swagger, config) {

    var baseUrl = '/campaigns',
        baseUrlWithId = baseUrl + "/{id}";

    swagger.addGet({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId,
            notes: "returns a campaign based on id",
            summary: "find campaign by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the campaign to be fetched", "string"),
                genericHandlers.params.populate,
                genericHandlers.params.populatedeep],
            "responseClass": "Campaign",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "getCampaignById",
            accessLevel: 'al_user'
        },
        action: genericHandlers.getByIdFn(baseUrl, Campaign)
    });

    swagger.addGet({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + '/stats',
            notes: "returns a campaign statistics of campaign based on id",
            summary: "get campaign statis of campaign with id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the campaign to be fetched", "string")],
            "responseClass": "Campaign",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "getCampaignStatsById",
            accessLevel: 'al_user'
        },
        action: campaignHandlers.getCampaignStats(baseUrl, Campaign)
    });

    swagger.addGet({
        spec: {
            description: "Operations about campaigns",
            path: baseUrl,
            notes: "returns all campaigns for the authenticated user",
            summary: "returns all campaigns for the authenticated user",
            params: [genericHandlers.params.sort,
                genericHandlers.params.limit,
                genericHandlers.params.filter,
                genericHandlers.params.populate,
                genericHandlers.params.populatedeep],
            method: "GET",
            "responseClass": "Campaign",
            "nickname": "getCampaigns",
            accessLevel: 'al_individual'
        },
        action: campaignHandlers.getAllForUserFn(baseUrl, Campaign)
    });

    swagger.addPost({
        spec: {
            description: "Operations about campaigns",
            path: baseUrl,
            notes: "creates a campaign and assigns the authenticated user as campaign lead",
            summary: "creates a campaign",
            method: "POST",
            params: [swagger.bodyParam("campaign", "campaign object", "Campaign")],
            "responseClass": "Campaign",
            "errorResponses": [],
            "nickname": "postCampaign",
            accessLevel: 'al_user'
        },
        action: campaignHandlers.postFn(baseUrl)
    });

    swagger.addPost({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + "/inviteCampaignLeadEmail",
            notes: "Posts a request for an invitation for one or more email-addresses",
            summary: "Request an invitation for to become campaign lead to be sent by the backend to the supplied email address(es)",
            params: [
                {
                    paramType: "body",
                    name: "email",
                    description: "object with one property: 'email', an email address, or an array of adresses, or a separated String of emails (by ';, ')",
                    dataType: "Object",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "postCampaignLeadPlanInvite",
            accessLevel: 'al_orgadmin',
            beforeCallbacks: []
        },
        action: campaignHandlers.postCampaignLeadInvite
    });

    swagger.addPost({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + "/assignCampaignLead",
            notes: "Posts a request to add the current user as campaignLead to this campaign: special endpoint that can be called without al_campaignLead but needs a token instead for auth",
            summary: "With this endpoint a non-privileged user can assign himself to become campaign lead when he has an invitation token.",
            params: [
                {
                    paramType: "query",
                    name: "token",
                    description: "the authtoken the user has gotten with his invitation email",
                    dataType: "String",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "assignCampaignLead",
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: campaignHandlers.assignCampaignLead
    });


    swagger.addDelete({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId,
            notes: "deletes the campaign with passed id",
            summary: "deletes the campaign with passed id",
            method: "DELETE",
            params: [swagger.pathParam("id", "ID of the user to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "deleteCampaign",
            accessLevel: 'al_systemadmin'

        },
        action: genericHandlers.deleteByIdFn(baseUrl, Campaign)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about campaigns",
            path: baseUrl,
            notes: "deletes all campaigns",
            summary: "deletes all campaigns",
            method: "DELETE",
            params: [],
            "errorResponses": [],
            "nickname": "deleteAllCampaigns",
            accessLevel: 'al_systemadmin'
        },
        action: genericHandlers.deleteAllFn(baseUrl, Campaign)
    });
};