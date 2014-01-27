/**
 * User Routes module
 *    these routes require authenticated users
 */
var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlan'),
    generic = require('./../handlers/generic'),
    handlers = require('../handlers/activityplan_handlers');

module.exports = function (swagger, config) {

    var baseUrl = '/activityplans';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl + '/joinOffers',
            notes: "only returns public plans and is constrained by activity-Reference",
            summary: "returns activityPlans other users have published to invite colleages to join",
            params: [
                {
                    paramType: "query",
                    name: "activity",
                    description: "the activity for which joinOffers are fetched",
                    dataType: "string",
                    required: true
                },
                generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep
            ],
            method: "GET",
            "responseClass": "ActivityPlan",
            "nickname": "getJoinOffers",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getJoinOffers
    });

    swagger.addGet({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId,
            notes: "Returns an activityPlan by Id, only returns the plan if the current user is the owner of the plan",
            summary: "Returns an activityPlan by Id",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activityPlan to fetch ",
                    dataType: "string",
                    required: true
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "ActivityPlan",
            method: "GET",
            "nickname": "getActivityPlan",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addGet({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl,
            notes: "only returns ActivityPlans of the current user, the API does not allow to retrieve" +
                "plans owned by other users",
            summary: "returns all activityPlans of the currently logged in user",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "ActivityPlan",
            "nickname": "getActivityPlans",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getAllFn(baseUrl, Model)
    });



    swagger.addGet({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId + '/ical.ics',
            notes: "Returns a file that can be imported into Outlook",
            summary: "fetch a calendar ics file for the activityPlan by id",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activityPlan for which to fetch the ical file",
                    dataType: "string",
                    required: true
                },
                {
                    paramType: "query",
                    name: "email",
                    description: "send calendar event as email",
                    dataType: "boolean"
                }
            ],
            method: "GET",
            "nickname": "getActivityPlanICal",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getIcalStringForPlan
    });


    swagger.addDelete({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId,
            notes: "Deletes a specific activityPlan",
            summary: "Deletes a specific activityPlan",
//            params: [
//                {
//                    paramType: "path",
//                    name: "id",
//                    description: "the id of the activityPlan to fetch ",
//                    dataType: "string",
//                    required: true
//                }
//            ],
            params: [swagger.pathParam("id", "the id of the activityPlan to fetch", "string")],

            method: "DELETE",
            "nickname": "deleteActivityPlan",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteOrUpdateActivityPlan
    });

    swagger.addDelete({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl,
            notes: "Deletes all activityPlans",
            summary: "Deletes all activityPlans",
            method: "DELETE",
            "nickname": "deleteActivityPlans",
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteAllFn(baseUrl, Model)
    });

    swagger.addPost({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId + "/inviteEmail",
            notes: "Posts an invitation for one or more email-addresses",
            summary: "Request an invitation for joining this plan to be sent by the backend to the supplied email address(es)",
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
            "nickname": "postActivityPlanInvite",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postActivityPlanInvite
    });


    swagger.addPost({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl,
            notes: "Posts a new plan, when the attribute masterPlan is set to the string of another plan, " +
                "then the new plan is just a slave of " +
                "this plan (the user is basically joining the masterPlan). When the attribute masterPlan is empty," +
                "then this new plan can become a masterPlan, when other users post slavePlans later.",
            summary: "Posts a new activityPlan",
            params: [
                {
                    paramType: "body",
                    name: "activityPlan",
                    description: "the activityPlan to store",
                    dataType: "ActivityPlan",
                    required: true
                }
            ],
            method: "POST",
            "nickname": "postActivityPlan",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postNewActivityPlan
    });

    swagger.addPut({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId,
            notes: "Updates an existing Plan. EXPERIMENTAL - NOT CURRENTLY SUPPORTED!",
            summary: "Updates an existing activityPlan",
            params: [
                {
                    paramType: "body",
                    name: "activityPlan",
                    description: "the activityPlan to store",
                    dataType: "ActivityPlan",
                    required: true
                },
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activityPlan to update ",
                    dataType: "string",
                    required: true
                }
            ],
            method: "PUT",
            "nickname": "putActivityPlan",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Model)
    });

    swagger.addPut({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl + '/{planId}/events/{eventId}',
            notes: "To set done, missed and feedback. Allows to add a single new comment to the event",
            summary: "Updates an existing ActivityEvent of an existing ActivityPlan.",
            params: [
                {
                    paramType: "body",
                    name: "activityPlanEvent",
                    description: "the activityPlanEvent to store",
                    dataType: "Event",
                    required: true
                },
                {
                    paramType: "path",
                    name: "planId",
                    description: "the id of activityPlan that contains the event to update ",
                    dataType: "string",
                    required: true
                },
                {
                    paramType: "path",
                    name: "eventId",
                    description: "the id of the event to update",
                    dataType: "string",
                    required: true
                }
            ],
            method: "PUT",
            "nickname": "putActivityPlanEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.putActivityEvent
    });
};
