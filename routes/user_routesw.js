/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    generic = require('./../handlers/generic'),
    userHandlers = require('./../handlers/user_handlers.js');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (swagger, config) {

    var baseUrl = '/users',
        baseUrlWithId = baseUrl + "/{id}";


    swagger.addPost({
        spec: {
            description: "avatar image upload",
            path: baseUrlWithId + "/avatar",
            summary: "avatar image upload",
            method: "POST",
            "nickname": "avatarImagePost",
            accessLevel: 'al_user'
        },
        action: userHandlers.avatarImagePostFn(baseUrl)
    });

    swagger.addPost({
        spec: {
            description: "email verification description",
            path: baseUrlWithId + "/email_verification",
            notes: "email verification notes",
            summary: "email verification",
            method: "POST",
            params: [swagger.bodyParam("token", "the token a user's email address is verified with", "string")],
            "errorResponses": [swagger.errors.invalid('token')],
            "nickname": "verifyEmailToken",
            accessLevel: 'al_user'
        },
        action: userHandlers.emailVerificationPostFn(baseUrl)
    });

    swagger.addPost({
        spec: {
            description: "password reset",
            path: baseUrl + "/password_reset",
            notes: "resets a user's password to a new password with a temporary token as credentials",
            summary: "password reset",
            method: "POST",
            params: [swagger.bodyParam("token", "a JSON object with two attributes 'token' and 'password'", "string")],
            "errorResponses": [swagger.errors.invalid('token'), swagger.errors.invalid('password')],
            "nickname": "resetpassword",
            accessLevel: 'al_anonymousonly'
        },
        action: userHandlers.passwordResetPostFn(baseUrl)
    });

    swagger.addPost({
        spec: {
            description: "request password reset",
            path: baseUrl + "/request_password_reset",
            notes: "requests a password reset for the supplied username or email. An email will be sent to the user" +
                " with a link that allows him to reset his password",
            summary: "requests a password reset for the supplied username or email.",
            method: "POST",
            params: [swagger.bodyParam("username", "a JSON object with one attribute 'usernameOrEmail'", "string")],
            "errorResponses": [swagger.errors.invalid('usernameOrEmail')],
            "nickname": "requestPasswordReset",
            accessLevel: 'al_anonymousonly'
        },
        action: userHandlers.requestPasswordResetPostFn(baseUrl)
    });

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
            "nickname": "getUserById",
            accessLevel: 'al_all'
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
            "nickname": "getUsers",
            accessLevel: 'al_admin'
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
            "nickname": "putUserById",
            accessLevel: 'al_user'
        },
        action: generic.putFn(baseUrl, User)
    });

    swagger.addPost({
        spec: {
            description: "Operations about users",
            path: baseUrl,
            notes: "creates the user and an associated empty user profile from the object passed in the body and returns the new use",
            summary: "creates a new user and an empty user profile",
            method: "POST",
            params: [swagger.bodyParam("user", "updated user object", "User")],
            "responseClass": "User",
            "errorResponses": [],
            "nickname": "postUser",
            accessLevel: 'al_all'
        },
        action: userHandlers.postFn(baseUrl)
    });

    swagger.addDelete({
        spec: {
            description: "Operations about users",
            path: baseUrlWithId,
            notes: "deletes the user and associated profile with passed id",
            summary: "deletes the user and associated profile with passed id",
            method: "DELETE",
            params: [swagger.pathParam("id", "ID of the user to be deleted", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "deleteUser",
            accessLevel: 'al_systemadmin'

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
            "nickname": "deleteAllUsers",
            accessLevel: 'al_systemadmin'
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