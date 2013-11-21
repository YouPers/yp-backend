var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/api/v1/';

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});

// just do a simple call, until the DB is ready
frisby.create('GET all activites')
    .get(URL + 'activities')
    .toss();

frisby.create('GET all activityPlans')
    .get(URL + 'activitiesPlanned')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        activity: String
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function (plans) {

        // Use data from previous result in next test
        frisby.create('Get single ActivityPlanned: ' + plans[0].id)
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
            .afterJSON(function (updatedEvent) {
                var nrOfComments = plans[0].events[0].comments.length;
                frisby.create('Get plan again and check whether feedback is updated')
                    .get(URL + 'activitiesPlanned/' + plans[0].id)
                    .expectStatus(200)
                    .afterJSON(function (newPlan) {
                        expect(newPlan.events[0].feedback).toEqual(5);
                        frisby.create('update Events again, reset feedback, add comment')
                            .put(URL + 'activitiesPlanned/' + newPlan.id + '/events/' + newPlan.events[0].id,
                            {"feedback": "2", "comments": [
                                {"text": "new Text from UnitTest"}
                            ]}, {json: true})
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                expect(newUpdatedEvent.comments.length).toEqual(nrOfComments + 1);
                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();

    })
    .toss();


frisby.create('plan once activity and check whether event is generated')
    .post(URL + 'activitiesPlanned', {
        "owner": "525fb247101e330000001008",
        "activity": "5268e8bca8bae50000000016",
        "privacy": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(1);
        expect(newPlan.events[0].begin).toEqual('2014-10-16T12:00:00.000Z');
        frisby.create('delete again')
            .delete(URL + 'activitiesPlanned/' + newPlan.id)
            .expectStatus(200)
            .toss();
    })
    .toss();


frisby.create('plan weekly activity and check whether events are generated, with End-By: after 6')
    .post(URL + 'activitiesPlanned', {
        "owner": "525fb247101e330000001008",
        "activity": "5268e8bca8bae50000000016",
        "privacy": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "week",
            "recurrence": {
                "end-by": {
                    "type": "after",
                    "after": 6
                },
                "every": 1,
                "exceptions": []
            }
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(6);
        expect(newPlan.events[0].begin).toEqual('2014-10-16T12:00:00.000Z');
        expect(newPlan.events[1].begin).toEqual('2014-10-23T12:00:00.000Z');
        frisby.create('delete again')
            .delete(URL + 'activitiesPlanned/' + newPlan.id)
            .expectStatus(200)
            .toss();
    })
    .toss();

frisby.create('plan daily activity and check whether events are generated, with End-By: after 6')
    .post(URL + 'activitiesPlanned', {
        "owner": "525fb247101e330000001008",
        "activity": "5268e8bca8bae50000000016",
        "privacy": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "day",
            "recurrence": {
                "end-by": {
                    "type": "after",
                    "after": 6
                },
                "every": 1,
                "exceptions": []
            }
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(6);
        expect(newPlan.events[0].end).toEqual('2014-10-16T13:00:00.000Z');
        expect(newPlan.events[5].end).toEqual('2014-10-22T13:00:00.000Z');
        frisby.create('delete again')
            .delete(URL + 'activitiesPlanned/' + newPlan.id)
            .expectStatus(200)
            .toss();
    })
    .toss();
