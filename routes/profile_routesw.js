/**
 * Profile Routes module
 *    these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var mongoose = require('mongoose'),
    Profile = mongoose.model('Profile'),
    generic = require('./../handlers/generic'),
    handlers = require('../handlers/profile_handlers.js');

module.exports = function (swagger, config) {

    var baseUrl = '/profiles',
        baseUrlWithId = baseUrl + "/{id}",
        baseUrlActual = baseUrl + "actual";

    swagger.addGet({
        spec: {
            description: "Operations about user profiles",
            path: baseUrlWithId,
            notes: "returns a profile with id id",
            summary: "find profile by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of profile to be fetched", "string"),
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Profile",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile"), swagger.errors.forbidden()],
            "nickname": "getProfileByUserId",
            accessLevel: 'al_all'
        },
        action: generic.getByIdFn(baseUrl, Profile)
    });

    swagger.addGet({
        spec: {
            description: "Operations about user profiles",
            path: baseUrl,
            notes: "returns all profiles of the current user",
            summary: "returns all profiles of the current user, i.e. the complete profile history",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Profile",
            "nickname": "getUserProfiles",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Profile)
    });

    swagger.addGet({
        spec: {
            description: "Operations about user profiles",
            path: baseUrlActual,
            notes: "the most recently created profile in the current user's profile history is the actual profile",
            summary: "returns the actual of the current user, i.e. the complete profile history",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Profile",
            "nickname": "getActualUserProfile",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.getActualProfile(baseUrl, Profile)
    });


//    swagger.addPut({
//        spec: {
//            description: "Operations about profiles",
//            path: baseUrlWithId,
//            notes: "updates the profile with user id id",
//            summary: "updates the profile",
//            method: "PUT",
//            params: [swagger.pathParam("id", "ID of the user to be updated", "string"), swagger.bodyParam("profile", "updated profile object", "Profile")],
//            "responseClass": "Profile",
//            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
//            "nickname": "putProfileByUserId",
//            accessLevel: 'al_user'
//        },
//        action: generic.putFn(baseUrl, Profile)
//    });

    swagger.addPost({
        spec: {
            description: "Operations about profiles",
            path: baseUrl,
            notes: "creates a new profile",
            summary: "creates the user profile from the object passed in the body and returns the new user profile",
            method: "POST",
            params: [swagger.bodyParam("profile", "updated profile object", "Profile")],
            "responseClass": "Profile",
            "errorResponses": [],
            "nickname": "postUserProfile",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.postFn(baseUrl, Profile)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about profiles",
            path: baseUrlWithId,
            notes: "can be used to delete a specific profile version of the current user ",
            summary: "deletes the user profile with the specific id for the current user ",
            method: "DELETE",
            params: [swagger.pathParam("id", "user ID of the profile to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
            "nickname": "deleteSpecificProfile",
            accessLevel: 'al_individual'
        },
        action: generic.deleteByIdFn(baseUrl, Profile)
    });
    swagger.addDelete({
        spec: {
            description: "Operations about profiles",
            path: baseUrl,
            notes: "deletes profile including complete profile history of current user",
            summary: "deletes profile including complete profile history of current user",
            method: "DELETE",
            params: [],
            "errorResponses": [],
            "nickname": "deleteAllProfilesOfUser",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: handlers.deleteAllFn(baseUrl, Profile)
    });

    swagger.addPost({
        spec: {
            description: "validate authentication credentials",
            path: "/login",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            accessLevel: 'al_user'
        },
        action: function(req, res, next) {
            req.log.trace({user: req.user},'/login: user authenticated');
            res.send(req.user);
            return next();
        }
    });
};