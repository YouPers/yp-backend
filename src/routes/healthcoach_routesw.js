/**
 * Organization Routes module
 */
var coachHandlers = require('./../handlers/coach_handlers.js'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/coachmessages';

    swagger.addGet({
            spec: {
                description: "get current HealthCoach messages for this user ",
                path: baseUrl,
                summary: "get currently suitable health coach messages for this user ",
                params: [
                    {
                        "name": "uistate",
                        "description": 'the current uistate of the user',
                        "dataType": 'string',
                        "required": true,
                        "allowMultiple": false,
                        "paramType": "query"
                    },
                    {
                        "name": "debug",
                        "description": 'returns the facts object that has been used to calculate the messages as last entry of the result array',
                        "dataType": 'boolean',
                        "required": false,
                        "allowMultiple": false,
                        "paramType": "query"
                    }
                ],
                method: "GET",
                responseClass: "Array[string]",
                "nickname": "coachMessagesGet",
                accessLevel: 'al_all'},
            action: coachHandlers.getCoachMessagesFn
        }
    );

    swagger.addGet({
        spec: {
            description: "Operations about ActivityOffers",
            path: '/coachRecommendations',
            notes: "returns the current coachRecommendations for a user",
            method: "GET",
            "responseClass": "Array[ActivityOffer]",
            "nickname": "getCoachRecommendations",
            params: [
                generic.params.limit,
                generic.params.populate,
                {"name": "topic",
                    "description": 'chooses the topic to get the recommendations for (overriding the users current campaign)',
                    "dataType": 'string',
                    "required": false,
                    "allowMultiple": false,
                    "paramType": "query"
                }
            ],
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: coachHandlers.getCoachRecommendationsFn
    });

};
