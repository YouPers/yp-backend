/**
 * User Routes module
 *    these routes require authenticated users
 */
var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlan'),
    generic = require('./../handlers/generic'),
    passport = require('passport'),
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
                    dataType: "ObjectId",
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
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
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
                    dataType: "ObjectId",
                    required: true
                },
                generic.params.populate,
                generic.params.populatedeep
            ],
            "responseClass": "ActivityPlan",
            method: "GET",
            "nickname": "getActivityPlan",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
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
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
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
                    dataType: "ObjectId",
                    required: true
                }
            ],
            method: "GET",
            "nickname": "getActivityPlanICal",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: handlers.getIcalStringForPlan
    });


    swagger.addDelete({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrlWithId,
            notes: "Deletes a specific activityPlan",
            summary: "Deletes a specific activityPlan",
            params: [
                {
                    paramType: "path",
                    name: "id",
                    description: "the id of the activityPlan to fetch ",
                    dataType: "ObjectId",
                    required: true
                }
            ],
            method: "DELETE",
            "nickname": "deleteActivityPlan",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: generic.deleteByIdFn(baseUrl, Model)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl,
            notes: "Deletes all activityPlans",
            summary: "Deletes all activityPlans",
            method: "DELETE",
            "nickname": "deleteActivityPlans",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: generic.deleteAllFn(baseUrl, Model)
    });

    swagger.addPost({
        spec: {
            description: "Operations about ActivityPlans",
            path: baseUrl,
            notes: "Posts a new plan, when the attribute masterPlan is set to the ObjectId of another plan, " +
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
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
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
                    dataType: "ObjectId",
                    required: true
                }
            ],
            method: "PUT",
            "nickname": "putActivityPlan",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
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
                    dataType: "event",
                    required: true
                },
                {
                    paramType: "path",
                    name: "planId",
                    description: "the id of activityPlan that contains the event to update ",
                    dataType: "ObjectId",
                    required: true
                },
                {
                    paramType: "path",
                    name: "eventId",
                    description: "the id of the event to update",
                    dataType: "ObjectId",
                    required: true
                }
            ],
            method: "PUT",
            "nickname": "putActivityPlanEvent",
            beforeCallbacks: [passport.authenticate('basic', { session: false })]
        },
        action: handlers.putActivityEvent
    });
};
