/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('ypbackendlib').mongoose,
    User = mongoose.model('User'),
    generic = require('ypbackendlib').handlers,
    handlers = require('../handlers/user_handlers');

module.exports = function (swagger) {

    var baseUrl = '/users';

    swagger.addOperation({
        spec: {
            description: "Operations about Users",
            path: baseUrl + "/friends",
            notes: "current implementation is to return everybody in the same campaign, but the user himself",
            summary: "returns the friends list of the currently logged in user",
            params: [generic.params.populate],
            method: "GET",
            "responseClass": "Array[User]",
            "nickname": "getUsersFriends",
            accessLevel: 'al_user',
            beforeCallbacks: []
        },
        action: handlers.getFriends(baseUrl, User)
    });
};