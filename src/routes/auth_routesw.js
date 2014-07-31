var auth = require('../util/auth');
var passport = require('passport');


module.exports = function (swagger, config) {

    var baseUrl = '/auth/';


    swagger.addPost({
        spec: {
            description: "validate authentication credentials",
            path: baseUrl + "basic",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            authMiddleware: passport.authenticate([ 'basic' ], {session: false}),
            accessLevel: 'al_user'
        },
        action: auth.loginAndExchangeTokenOauth
    });

    swagger.addGet({
        spec: {
            description: "validate authentication credentials",
            path: baseUrl + "github",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            authMiddleware: passport.authenticate([ 'github' ], {session: false}),
            accessLevel: 'al_user'
        },
        action: null
    });

    swagger.addGet({
        spec: {
            description: "validate authentication credentials",
            path: baseUrl + "github/callback",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            authMiddleware: passport.authenticate([ 'github' ], {session: false}),
            accessLevel: 'al_user'
        },
        action: auth.loginAndExchangeTokenRedirect
    });

    swagger.addGet({
        spec: {
            description: "validate authentication credentials",
            path: baseUrl + "facebook",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            authMiddleware: passport.authenticate([ 'facebook' ], {session: false}),
            accessLevel: 'al_user'
        },
        action: null
    });

    swagger.addGet({
        spec: {
            description: "validate authentication credentials",
            path: baseUrl + "facebook/callback",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            authMiddleware: passport.authenticate([ 'facebook' ], {session: false}),
            accessLevel: 'al_user'
        },
        action: auth.loginAndExchangeTokenRedirect
    });


    swagger.addPost({
        spec: {
            description: "validate authentication credentials",
            path: "/login",
            notes: "validates the passed credentials and returns the user object belonging to the credentials",
            summary: "currently supports HTTP Basic Auth and Bearer Token over HTTPS",
            method: "POST",
            params: [swagger.headerParam("Authentication", "HTTP Basic Auth credentials", "string", true)],
            responseClass: "User",
            "errorResponses": [],
            "beforeCallbacks": [],
            "nickname": "login",
            accessLevel: 'al_user'
        },
        action: auth.loginAndExchangeTokenAjax
    });

};