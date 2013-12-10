/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    generic = require('./../handlers/generic'),
    passport = require('passport');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (swagger, config) {

    var baseUrl = '/users',
        baseUrlWithId = baseUrl + "/{id}";

    swagger.addGet({
        spec: {
            description: "Operations about users",
            path: baseUrlWithId,
            notes: "returns a user based on id",
            summary: "find user by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the user to be fetched", "string"),
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "User",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getUserById"
        },
        action: generic.getByIdFn(baseUrl, User)
    });

    swagger.addGet({
        spec: {
            description: "Operations about users",
            path: baseUrl,
            notes: "returns all users",
            summary: "returns all users",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "User",
            "nickname": "getUsers"
        },
        action: generic.getAllFn(baseUrl, User)
    });


    swagger.addPut({
        spec: {
            description: "Operations about users",
            path: baseUrlWithId,
            notes: "updates the user with id id",
            summary: "updates the user",
            method: "PUT",
            params: [swagger.pathParam("id", "ID of the user to be updated", "string"), swagger.bodyParam("user", "updated user object", "User")],
            "responseClass": "User",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "putUserById"
        },
        action: generic.putFn(baseUrl, User)
    });

    swagger.addPost({
        spec: {
            description: "Operations about users",
            path: baseUrl,
            notes: "creates a new user",
            summary: "creates the user from the object passed in the body and returns the new user",
            method: "POST",
            params: [swagger.bodyParam("user", "updated user object", "User")],
            "responseClass": "User",
            "errorResponses": [],
            "nickname": "postUser"
        },
        action: generic.postFn(baseUrl, User)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about users",
            path: baseUrlWithId,
            notes: "deletes a user by ID",
            summary: "deletes the user with passed id",
            method: "DELETE",
            params: [swagger.pathParam("id", "ID of the user to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "deleteUser"
        },
        action: generic.deleteByIdFn(baseUrl, User)
    });
    swagger.addDelete({
        spec: {
            description: "Operations about users",
            path: baseUrl,
            notes: "deletes all users",
            summary: "deletes all users",
            method: "DELETE",
            params: [],
            "errorResponses": [],
            "nickname": "deleteAllUsers"
        },
        action: generic.deleteAllFn(baseUrl, User)
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
            "beforeCallbacks": [ passport.authenticate('basic', { session: false })],
            "nickname": "login"
        },
        action: function(req, res, next) {
            req.log.trace({user: req.user},'/login: user authenticated');
            res.send(req.user);
            return next();
        }
    });
};