/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
    Campaign = mongoose.model('Campaign'),
    genericHandlers = require('ypbackendlib').handlers,
    campaignHandlers = require('./../handlers/campaign_handlers'),
    enums = require('../models/enums');


module.exports = function (swagger) {

    var baseUrl = '/campaigns',
        baseUrlWithId = baseUrl + "/{id}";

    swagger.addOperation({
        spec: {
            description: "avatar image upload",
            path: baseUrlWithId + "/avatar",
            summary: "avatar image upload",
            mobileSDK: "disabled",
            method: "POST",
            "nickname": "avatarImagePost",
            accessLevel: 'al_campaignlead'
        },
        action: campaignHandlers.avatarImagePostFn(baseUrl)
    });

    swagger.addOperation({
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
            accessLevel: 'al_all'
        },
        action: genericHandlers.getByIdFn(baseUrl, Campaign)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + '/stats',
            notes: "returns a campaign statistics of campaign based on id",
            summary: "get campaign statis of campaign with id",
            method: "GET",
            params: [
                swagger.pathParam("id", "ID of the campaign to be fetched", "string"),
                {
                    paramType: "query",
                    name: "type",
                    description: "the type of statistics to fetch",
                    dataType: "string",
                    enum: enums.statsType,
                    required: true
                },
                {
                    paramType: "query",
                    name: "range",
                    description: "The timerange to constrain the stats to",
                    dataType: "string",
                    enum: ['day','week','month','year','all'],
                    default: 'all'
                }
            ],
            "responseClass": "string",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "getCampaignStatsById",
            accessLevel: 'al_campaignlead'
        },
        action: campaignHandlers.getCampaignStats(baseUrl, Campaign)
    });

    swagger.addOperation({
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
            "responseClass": "Array[Campaign]",
            "nickname": "getCampaigns",
            accessLevel: 'al_all'
        },
        action: campaignHandlers.getAllForUserFn(baseUrl, Campaign)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrl,
            notes: "creates a campaign and assigns the authenticated user as campaign lead",
            summary: "creates a campaign",
            mobileSDK: "disabled",
            method: "POST",
            params: [swagger.bodyParam("campaign", "campaign object", "Campaign")],
            "responseClass": "Campaign",
            "errorResponses": [],
            "nickname": "postCampaign",
            accessLevel: 'al_orgadmin'
        },
        action: campaignHandlers.postCampaign(baseUrl)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + "/inviteCampaignLeadEmail",
            notes: "Posts a request for an invitation for one or more email-addresses",
            summary: "Request an invitation for to become campaign lead to be sent by the backend to the supplied email address(es)",
            mobileSDK: "disabled",
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
            "nickname": "postCampaignLeadPlanInvite",
            accessLevel: 'al_campaignlead',
            beforeCallbacks: []
        },
        action: campaignHandlers.postCampaignLeadInvite
    });

    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + "/inviteParticipantsEmail",
            notes: "Posts a request for invitations to participate for one or more email-addresses",
            summary: "Request an invitation to participate in the campaign  to be sent by the backend to the supplied email address(es)",
            mobileSDK: "disabled",
            params: [
                {
                    paramType: "body",
                    name: "email",
                    description: "object with properties: 'email', an email address, or an array of adresses, or a separated String of emails (by ';, ')",
                    dataType: "EmailObject",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "postParticipantsInvite",
            accessLevel: 'al_campaignlead',
            beforeCallbacks: []
        },
        action: campaignHandlers.postParticipantsInvite
    });



    swagger.addModels({EmailObject: {
        id: 'EmailObject',
        required: ['email'],
        properties: {
            email: {type: 'string'},
            subject: {type: 'string'},
            text: {type: 'string'}
        }
    }});


    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId + "/assignCampaignLead",
            notes: "Posts a request to add the current user as campaignLead to this campaign: special endpoint that can be called without al_campaignLead but needs a token instead for auth",
            summary: "With this endpoint a non-privileged user can assign himself to become campaign lead when he has an invitation token.",
            mobileSDK: "disabled",
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
            "nickname": "assignCampaignLead",
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: campaignHandlers.assignCampaignLead
    });


    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId,
            notes: "deletes the campaign with passed id",
            summary: "deletes the campaign with passed id",
            mobileSDK: "disabled",
            method: "DELETE",
            params: [swagger.pathParam("id", "ID of the user to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "deleteCampaign",
            accessLevel: 'al_systemadmin'

        },
        action: genericHandlers.deleteByIdFn(baseUrl, Campaign)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrl,
            notes: "deletes all campaigns",
            summary: "deletes all campaigns",
            mobileSDK: "disabled",
            method: "DELETE",
            params: [],
            "errorResponses": [],
            "nickname": "deleteAllCampaigns",
            accessLevel: 'al_systemadmin'
        },
        action: genericHandlers.deleteAllFn(baseUrl, Campaign)
    });


    swagger.addOperation({
        spec: {
            description: "Operations about campaigns",
            path: baseUrlWithId,
            notes: "updates the campaign with id id",
            summary: "updates the campaign",
            mobileSDK: "disabled",
            method: "PUT",
            params: [swagger.pathParam("id", "ID of the campaign to be updated", "string"), swagger.bodyParam("campaign", "campaign object to be updated", "Campaign")],
            "responseClass": "Campaign",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("campaign")],
            "nickname": "putCampaignById",
            accessLevel: 'al_campaignlead'
        },
        action: campaignHandlers.putCampaign
    });

};