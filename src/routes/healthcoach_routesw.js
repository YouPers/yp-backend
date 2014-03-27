/**
 * Organization Routes module
 */
var  coachHandlers = require('./../handlers/coach_handlers.js');

module.exports = function (swagger, config) {

    var baseUrl = '/coachmessages';

    swagger.addGet({
        spec: {
            description: "get current HealthCoach messages for this user ",
            path: baseUrl,
            summary: "get currently suitable health coach messages for this user ",
            method: "GET",
            "nickname": "coachMessagesGet",
            accessLevel: 'al_all'
        },
        action: coachHandlers.getCoachMessagesFn(baseUrl)
    });
};
