var frisby = require('frisby');
require('../app.js');
var port = process.env.PORT || 3000;
var URL = 'http://localhost:'+ port +'/api/v1/';

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic cmV0bzpyZXRv'
        }

    }
});

frisby.create('GET all activityPlans')
    .get(URL + 'activitiesPlanned')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        activity: String,
        planType: String
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(plans) {

        // Use data from previous result in next test
        frisby.create('Get single ActivityPlanned')
            .get(URL + 'activitiesPlanned/' + plans[0].id)
            .expectStatus(200)
            .expectJSON({
                id: String,
                activity: String,
                planType: String
            })
            .toss();
    })
    .toss();