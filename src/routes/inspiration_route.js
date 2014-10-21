/**
 * Organization Routes module
 */
var coachHandlers = require('./../handlers/coach_handlers.js'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    swagger.addOperation({
        spec: {
            description: "Operations about EventOffers",
            path: '/coachRecommendations',
            notes: "returns the current coachRecommendations for a user",
            method: "GET",
            "responseClass": "Array[EventOffer]",
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
