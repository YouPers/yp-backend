/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    genericHandlers = require('./../handlers/generic'),
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
            params: [swagger.pathParam("id", "ID of the user to be fetched", "string")],
            "responseClass": "User",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getUserById"
        },
        action: genericHandlers.getByIdFn(baseUrl, User)
    });

    swagger.addGet({
        spec: {
            description: "Operations about users",
            path: baseUrl,
            notes: "returns all users",
            summary: "returns all users",
            method: "GET",
            "responseClass": "User",
            "nickname": "getUsers"
        },
        action: genericHandlers.getAllFn(baseUrl, User)
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
        action: genericHandlers.putFn(baseUrl, User)
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
        action: genericHandlers.postFn(baseUrl, User)
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
        action: genericHandlers.deleteByIdFn(baseUrl, User)
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
        action: genericHandlers.deleteAllFn(baseUrl, User)
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