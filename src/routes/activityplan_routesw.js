/**
 * User Routes module
 *    these routes require authenticated users
 */
var mongoose = require('mongoose'),
    Model = mongoose.model('Activity'),
    generic = require('./../handlers/generic'),
    handlers = require('../handlers/activity_handlers');

module.exports = function (swagger, config) {

    var baseUrl = '/activities';
    var baseUrlWithId = baseUrl + '/{id}';

    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrl + "/conflicts",
            notes: "Gets the list of conflicting events in case there are any for the activity in the body." +
                "If there are no conflicts, it returns an emtpy list",
            summary: "Validates an activity that a user is about to POST",
            params: [
                {
                    paramType: "body",
                    name: "activity",
                    description: "the activity to validate",
                    dataType: "Activity",
                    required: true
                }
            ],
            responseClass: "SchedulingConflict",
            method: "POST",
            "nickname": "getActivityConflicts",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getActivityConflicts
    });

    swagger.addModels({SchedulingConflict: {
        id: 'SchedulingConflict',
        required: ['conflictingNewEvent', 'conflictingSavedEvent'],
        properties: {
            conflictingNewEvent: {type: 'ActivityEvent'},
            conflictingSavedEvent: {type: 'ActivityEvent'}
        }
    }});

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Returns an activity by Id, only returns the activity if the current user is the owner of the activity",
            summary: "Returns an activity by Id",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activity to fetch ",
                    dataType: "string",
                    required: true
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "Activity",
            method: "GET",
            "nickname": "getActivity",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addGet({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "only returns Activities of the current user, the API does not allow to retrieve" +
                "plans owned by other users",
            summary: "returns all activities of the currently logged in user",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[Activity]",
            "nickname": "getActivities",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Deletes a specific activity",
            summary: "Deletes a specific activity",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activity to fetch ",
                    dataType: "string",
                    required: true
                }
            ],

            method: "DELETE",
            "nickname": "deleteActivity",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteActivity
    });

    swagger.addDelete({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "Deletes all activities",
            summary: "Deletes all activities",
            method: "DELETE",
            "nickname": "deleteActivities",
            accessLevel: 'al_admin',
            beforeCallbacks: []
        },
        action: generic.deleteAllFn(baseUrl, Model)
    });

    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + "/inviteEmail",
            notes: "Posts an invitation for one or more email-addresses",
            summary: "Request an invitation for joining this activity to be sent by the backend to the supplied email address(es)",
            params: [
                {
                    paramType: "body",
                    name: "email",
                    description: "object with one property: 'email', an email address, or an array of adresses, or a separated String of emails (by ';, ')",
                    dataType: "EmailObject",
                    required: true
                },
                swagger.pathParam("id", "the id of the activity to invite", "string")
            ],
            method: "POST",
            "nickname": "postActivityInvite",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postActivityInvite
    });

    swagger.addModels({EmailObject: {
        id: 'EmailObject',
        required: ['email'],
        properties: {
            email: {type: 'string'}
        }
    }});

    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + "/join",
            notes: "Joins an activity",
            summary: "Joins an activity",
            params: [swagger.pathParam("id", "the id of the activity to join", "string")],
            method: "POST",
            "nickname": "postJoinActivityFn",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postJoinActivityFn
    });


    swagger.addPost({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "Posts a new activity. JoiningUsers property has to be empty - use the activity/join API to join an existing activity",
            summary: "Posts a new activity",
            responseClass: "Activity",
            params: [
                {
                    paramType: "body",
                    name: "activity",
                    description: "the activity to store",
                    dataType: "Activity",
                    required: true
                }
            ],
            method: "POST",
            nickname: "postActivity",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postNewActivity
    });



    swagger.addPut({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Updates an existing activity.",
            summary: "Updates an existing activity",
            method: "PUT",
            params: [swagger.pathParam("id", "the id of the activity to update", "string"), swagger.bodyParam("activity", "activity to be updated", "Activity")],
            "responseClass": "Activity",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("activity")],
            "nickname": "putActivity",
            accessLevel: 'al_individual'
        },
        action: handlers.putActivity
    });
};
