var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});


frisby.create('plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": "525fb247101e330000001008",
        "activity": "5278c6adcdeab69a2500001e",
        "visibility": "public",
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
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();
        expect(newPlan.masterPlan).not.toBeDefined();

        frisby.create('GET this activity plan by Id und check whether it is there')
            .get(URL + '/activityplans/' + newPlan.id)
            .expectStatus(200)
            .expectJSON({
                id: newPlan.id,
                activity: '5278c6adcdeab69a2500001e'
            })
            .toss();

        frisby.create('GET all activityplans and check whether the created one is in the returned list')
            .get(URL + '/activityplans')
            .expectStatus(200)
            .expectJSON('*', {
                id: String,
                activity: String
            })
            .afterJSON(function (plans) {

                expect(_.find(plans, function (plan) {
                    return (plan.id === newPlan.id);
                })).toBeDefined();

                frisby.create('delete the created activityPlan again')
                    .delete(URL + '/activityplans/' + newPlan.id)
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('GET this activity plan by Id again und check whether it is not there anymore')
                            .get(URL + '/activityplans/' + newPlan.id)
                            .expectStatus(204)
                            .toss();


                        frisby.create('GET all activityplans again and check whether the plan has really been deleted')
                            .get(URL + '/activityplans')
                            .expectStatus(200)
                            .expectJSON('*', {
                                id: String,
                                activity: String
                            })
                            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
                            .afterJSON(function (plans) {
                                expect(_.find(plans, function (plan) {
                                    return (plan.id === newPlan.id);
                                })).toBeUndefined();
                            })
                            .toss();
                    })
                    .toss();
            })
            .toss();
    })
    .toss();


frisby.create('plan weekly activity and check whether events are generated, with End-By: after 6')
    .post(URL + '/activityplans', {
        "owner": "525fb247101e330000001008",
        "activity": "5278c6adcdeab69a2500001e",
        "visibility": "public",
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
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();
        expect(newPlan.masterPlan).not.toBeDefined();
        expect(newPlan.events[0].status).toEqual('open');
        expect(newPlan.events[0].feedback).toBeUndefined();


        frisby.create('Update an Event without comment')
            .put(URL + '/activityplans/' + newPlan[0].id + '/events/' + newPlan[0].events[0].id, {feedback: 5, status: 'done'}, {json: true})
            .expectStatus(200)
            .afterJSON(function (updatedEvent) {
                var nrOfComments = plans[0].events[0].comments.length;
                expect(updatedEvent.feedback).toEqual(5);
                expect(updatedEvent.status).toEqual('done');

                frisby.create('Get plan again and check whether feedback is updated')
                    .get(URL + '/activityplans/' + newPlan[0].id)
                    .expectStatus(200)
                    .afterJSON(function (reloadedPlan) {
                        expect(reloadedPlan.events[0].feedback).toEqual(5);
                        expect(reloadedPlan.events[0].status).toEqual('done');
                        frisby.create('update Events again, reset feedback, add comment')
                            .put(URL + '/activityplans/' + reloadedPlan.id + '/events/' + reloadedPlan.events[0].id,
                            {"feedback": "2", "comments": [
                                {"text": "new Text from UnitTest"}
                            ]}, {json: true})
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                expect(newUpdatedEvent.comments.length).toEqual(nrOfComments + 1);
                                expect(newUpdatedEvent.feedback).toEqual(2);
                                frisby.create('delete again')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();

                    })
                    .toss();



            })
            .toss();
    });

frisby.create('plan daily activity and check whether events are generated, with End-By: after 6')
    .post(URL + '/activityplans', {
        "owner": "525fb247101e330000001008",
        "activity": "5278c6adcdeab69a2500001e",
        "visibility": "public",
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
        frisby.create('let another user join this plan')
            .removeHeader('Authorization')
            .auth('reto', 'reto')
            .post(URL + '/activityplans', {
                "owner": "525fb247101e330000000005",
                "activity": "5278c6adcdeab69a2500001e",
                "visibility": "public",
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
                "status": "active",
                "masterPlan": newPlan.id
            }
        )
            .expectStatus(201)
            .afterJSON(function (joiningPlan) {
                expect(joiningPlan.masterPlan).toEqual(newPlan.id);


                frisby.create('reload masterPlan from server')
                    .auth('unittest', 'test')
                    .get(URL + '/activityplans/' + newPlan.id)
                    .expectStatus(200)
                    .afterJSON(function (reloadedNewPlan) {
                        expect(_.indexOf(reloadedNewPlan.joiningUsers, joiningPlan.owner)).not.toEqual(-1);

                        frisby.create('delete plan 1')
                            .delete(URL + '/activityplans/' + newPlan.id)
                            .expectStatus(200)
                            .toss();

                        frisby.create('delete plan 2')
                            .delete(URL + '/activityplans/' + joiningPlan.id)
                            .expectStatus(200)
                            .toss();

                    }).toss();
            }).toss();
    })
    .toss();
