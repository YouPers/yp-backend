/**
 * User Routes module
 *    these routes require authenticated users
 */
var mongoose = require('ypbackendlib').mongoose,
    Model = mongoose.model('Event'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/event_handlers');

module.exports = function (swagger) {

    var baseUrl = '/activities';
    var baseUrlWithId = baseUrl + '/{id}';


    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + '/invitationStatus',
            notes: "Returns all Invitations for this event and a dissmissalReason if the invitation is already dismissed",
            summary: "Returns all Invitations along with their status",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the event to fetch ",
                    dataType: "string",
                    required: true
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "EventInvitationStatusResult",
            method: "GET",
            "nickname": "getEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getInvitationStatus
    });

    swagger.addModels({EventInvitationStatusResult: {
        id: 'EventInvitationStatusResult',
        properties: {
            user: {type: 'User'},
            email: {type: 'String'},
            status: {type: 'String'}
        }
    }});

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrl + "/validate",
            notes: "Validates a new event, generates the list of occurences and returns the list of conflicting occurences in case there are any for the event in the body.",
            summary: "Validates an event that a user is about to POST",
            params: [
                {
                    paramType: "body",
                    name: "event",
                    description: "the event to validate",
                    dataType: "Event",
                    required: true
                }
            ],
            responseClass: "EventValidationResult",
            method: "POST",
            "nickname": "validateEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.validateEvent
    });

    swagger.addModels({EventValidationResult: {
        id: 'EventValidationResult',
        required: ['occurence'],
        properties: {
            occurence: {type: 'Occurence'},
            conflictingEvent: {type: 'Occurence'}
        }
    }});

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Returns an event by Id, only returns the event if the current user is the owner of the event",
            summary: "Returns an event by Id",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the event to fetch ",
                    dataType: "string",
                    required: true
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "Event",
            method: "GET",
            "nickname": "getEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "only returns Activities of the current user, the API does not allow to retrieve" +
                "activities owned by other users",
            summary: "returns all activities of the currently logged in user",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[Event]",
            "nickname": "getActivities",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getAll
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + '/ical',
            notes: "use query param type to get cancel or update, defaults to new.",
            summary: "returns an ical.ics file for the event with the passed id",
            method: "GET",
            params: [],
            "nickname": "getEventIcal",
            accessLevel: 'al_all',
            beforeCallbacks: []
        },
        action: handlers.getIcal
    });

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Deletes a specific event",
            summary: "Deletes a specific event",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the event to fetch ",
                    dataType: "string",
                    required: true
                }
            ],

            method: "DELETE",
            "nickname": "deleteEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteEvent
    });

    swagger.addOperation({
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

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + "/inviteEmail",
            notes: "Posts an invitation for one or more email-addresses",
            summary: "Request an invitation for joining this event to be sent by the backend to the supplied email address(es)",
            params: [
                {
                    paramType: "body",
                    name: "email",
                    description: "object with one property: 'email', an email address, or an array of adresses, or a separated String of emails (by ';, ')",
                    dataType: "EmailObject",
                    required: true
                },
                swagger.pathParam("id", "the id of the event to invite", "string")
            ],
            method: "POST",
            "nickname": "postEventInvite",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postEventInvite
    });

    swagger.addModels({EmailObject: {
        id: 'EmailObject',
        required: ['email'],
        properties: {
            email: {type: 'string'}
        }
    }});

    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId + "/join",
            notes: "Joins an event",
            summary: "Joins an event",
            params: [swagger.pathParam("id", "the id of the event to join", "string")],
            method: "POST",
            "nickname": "postJoinEventFn",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postJoinEventFn
    });


    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrl,
            notes: "Posts a new event. JoiningUsers property has to be empty - use the event/join API to join an existing event",
            summary: "Posts a new event",
            responseClass: "Event",
            params: [
                {
                    paramType: "body",
                    name: "event",
                    description: "the event to store",
                    dataType: "Event",
                    required: true
                }
            ],
            method: "POST",
            nickname: "postEvent",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postNewEvent
    });



    swagger.addOperation({
        spec: {
            description: "Operations about Activities",
            path: baseUrlWithId,
            notes: "Updates an existing event.",
            summary: "Updates an existing event",
            method: "PUT",
            params: [swagger.pathParam("id", "the id of the event to update", "string"), swagger.bodyParam("event", "event to be updated", "Event")],
            "responseClass": "Event",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("event")],
            "nickname": "putEvent",
            accessLevel: 'al_individual'
        },
        action: handlers.putEvent
    });
};
