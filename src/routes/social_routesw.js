/**
 * Created by retoblunschi on 21.01.14.
 */
var mongoose = require('mongoose'),
    Model = mongoose.model('Comment'),
    socialHandlers = require('./../handlers/social_handlers.js');


module.exports = function (swagger, config) {

    var baseUrl = '/socialevents';

    swagger.addGet({
        spec: {
            description: "Operations about socialevents",
            path: baseUrl,
            notes: "returns the top social events for this user",
            summary: "social events for a user",
            method: "GET",
            params: [],
            "responseClass": "SocialEvent",
            "errorResponses": [swagger.errors.notFound("user")],
            "nickname": "getSocialEvents",
            accessLevel: 'al_individual'
        },
        action: socialHandlers.getListFn(baseUrl, Model)
    });
};