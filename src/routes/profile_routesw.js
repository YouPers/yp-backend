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
            path: baseUrl,
            notes: "returns the profile of the current user",
            summary: "returns the profile of the current user",
            params: [generic.params.sort,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Profile",
            "nickname": "getUsers",
            accessLevel: 'al_user'
        },
        action: generic.getAllFn(baseUrl, Profile)
    });

    swagger.addPut({
        spec: {
            description: "Operations about user profiles",
            path: baseUrlWithId,
            notes: "updates the user profile with id id",
            summary: "updates the user profile",
            method: "PUT",
            params: [swagger.pathParam("id", "ID of the user profile to be updated", "string"), swagger.bodyParam("profile", "user profile object to be updated", "Profile")],
            "responseClass": "Profile",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("profile")],
            "nickname": "putUserProfileById",
            accessLevel: 'al_user'
        },
        action: generic.putFn(baseUrl, Profile)
    });


};