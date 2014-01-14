/**
 * Profile Routes module
 *    these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var mongoose = require('mongoose'),
    Profile = mongoose.model('Profile'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/profiles',
        baseUrlWithId = baseUrl + "/{id}";

    swagger.addGet({
        spec: {
            description: "Operations about user profiles",
            path: baseUrlWithId,
            notes: "returns a profile based on user id",
            summary: "find profile by user id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the user to be fetched", "string"),
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Profile",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
            "nickname": "getProfileByUserId",
            accessLevel: 'al_all'
        },
        action: generic.getByIdFn(baseUrl, Profile)
    });

    swagger.addGet({
        spec: {
            description: "Operations about profiles",
            path: baseUrl,
            notes: "returns all user profiles",
            summary: "returns all user profiles",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Profile",
            "nickname": "getUserProfiles",
            accessLevel: 'al_admin'
        },
        action: generic.getAllFn(baseUrl, Profile)
    });


    swagger.addPut({
        spec: {
            description: "Operations about profiles",
            path: baseUrlWithId,
            notes: "updates the profile with user id id",
            summary: "updates the profile",
            method: "PUT",
            params: [swagger.pathParam("id", "ID of the user to be updated", "string"), swagger.bodyParam("profile", "updated profile object", "Profile")],
            "responseClass": "Profile",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
            "nickname": "putProfileByUserId",
            accessLevel: 'al_user'
        },
        action: generic.putFn(baseUrl, Profile)
    });

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
            accessLevel: 'al_all'
        },
        action: generic.postFn(baseUrl, Profile)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about profiles",
            path: baseUrlWithId,
            notes: "deletes a user profile by user ID",
            summary: "deletes the user profile with passed id",
            method: "DELETE",
            params: [swagger.pathParam("id", "user ID of the profile to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
            "nickname": "deleteProfile",
            accessLevel: 'al_systemadmin'

        },
        action: generic.deleteByIdFn(baseUrl, Profile)
    });
    swagger.addDelete({
        spec: {
            description: "Operations about profiles",
            path: baseUrl,
            notes: "deletes all user profiles",
            summary: "deletes all user profiles",
            method: "DELETE",
            params: [],
            "errorResponses": [],
            "nickname": "deleteAllUserProfiles",
            accessLevel: 'al_systemadmin'
        },
        action: generic.deleteAllFn(baseUrl, Profile)
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