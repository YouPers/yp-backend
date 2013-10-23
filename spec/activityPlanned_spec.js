var frisby = require('frisby');
require('../app.js');
var port = process.env.PORT || 8000;
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
        activity: String
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(plans) {

        // Use data from previous result in next test
        frisby.create('Get single ActivityPlanned')
            .get(URL + 'activitiesPlanned/' + plans[0].id)
            .expectStatus(200)
            .expectJSON({
                id: String,
                activity: String
            })
            .toss();


        frisby.create('Update an Event without comment')
            .put(URL + 'activitiesPlanned/' + plans[0].id + '/events/' + plans[0].events[0].id, {feedback: 5}, {json: true})
            .expectStatus(200)
            .expectJSON({feedback: 5})
            .afterJSON(function(updatedEvent) {
                var nrOfComments = plans[0].events[0].comments.length;
                frisby.create('Get plan again and check whether feedback is updated')
                    .get(URL + 'activitiesPlanned/' + plans[0].id)
                    .expectStatus(200)
                    .afterJSON(function (newPlan) {
                        expect(newPlan.events[0].feedback).toEqual(5);
                        frisby.create('update Events again, reset feedback, add comment')
                            .put(URL + 'activitiesPlanned/' + newPlan.id + '/events/' + newPlan.events[0].id,
                                {"feedback": "2", "comments": [{"text": "new Text from UnitTest"}]}, {json: true})
                            .expectStatus(200)
                            .afterJSON(function(newUpdatedEvent) {
                                expect(newUpdatedEvent.comments.length).toEqual(nrOfComments + 1);
                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();

    })
    .toss();