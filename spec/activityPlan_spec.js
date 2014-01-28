var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' },
        json: true
    }
});


frisby.create('Activity Plan: plan once activity and check whether event is generated')
    .removeHeader('Authorization')
    .auth(consts.users.unittest.username, consts.users.unittest.password)
    .post(URL + '/activityplans', {
        "owner": consts.users.unittest.id,
        "activity": consts.groupActivity2.id,
        "visibility": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-06-16T12:00:00.000Z",
            "end": "2014-06-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(1);
        expect(newPlan.events[0].begin).toEqual('2014-06-16T12:00:00.000Z');
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();
        expect(newPlan.masterPlan).not.toBeDefined();

        frisby.create('Activity Plan: GET this activity plan by Id und check whether it is there')
            .get(URL + '/activityplans/' + newPlan.id)
            .expectStatus(200)
            .expectJSON({
                id: newPlan.id,
                activity: consts.groupActivity2.id
            })
            .toss();

        frisby.create('Activity Plan: GET all activityplans and check whether the created one is in the returned list')
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

                frisby.create('Activity Plan: delete the created activityPlan again')
                    .delete(URL + '/activityplans/' + newPlan.id)
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('Activity Plan: GET this activity plan by Id again und check whether it is not there anymore')
                            .get(URL + '/activityplans/' + newPlan.id)
                            .expectStatus(204)
                            .toss();


                        frisby.create('Activity Plan: GET all activityplans again and check whether the plan has really been deleted')
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


frisby.create('Activity Plan: plan weekly activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activityplans', {
        "owner": consts.users.unittest.id,
        "activity": "5278c6adcdeab69a2500001e",
        "visibility": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "week",
            "recurrence": {
                "endby": {
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


        frisby.create('Activity Plan: Update an Event without comment')
            .put(URL + '/activityplans/' + newPlan[0].id + '/events/' + newPlan[0].events[0].id, {feedback: 5, status: 'done'}, {json: true})
            .expectStatus(200)
            .afterJSON(function (updatedEvent) {
                var nrOfComments = plans[0].events[0].comments.length;
                expect(updatedEvent.feedback).toEqual(5);
                expect(updatedEvent.status).toEqual('done');

                frisby.create('Activity Plan: Get plan again and check whether feedback is updated')
                    .get(URL + '/activityplans/' + newPlan[0].id)
                    .expectStatus(200)
                    .afterJSON(function (reloadedPlan) {
                        expect(reloadedPlan.events[0].feedback).toEqual(5);
                        expect(reloadedPlan.events[0].status).toEqual('done');
                        frisby.create('Activity Plan: update Events again, reset feedback, add comment')
                            .put(URL + '/activityplans/' + reloadedPlan.id + '/events/' + reloadedPlan.events[0].id,
                            {"feedback": "2", "comments": [
                                {"text": "new Text from UnitTest"}
                            ]}, {json: true})
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                expect(newUpdatedEvent.comments.length).toEqual(nrOfComments + 1);
                                expect(newUpdatedEvent.feedback).toEqual(2);
                                frisby.create('Activity Plan: delete again')
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

frisby.create('Activity Plan: plan daily activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activityplans', {
        "owner": consts.users.unittest.id,
        "activity": consts.groupActivity3.id,
        "visibility": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "day",
            "recurrence": {
                "endby": {
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
        expect(newPlan.events[5].end).toEqual('2014-10-23T13:00:00.000Z');  //skipping the two weekend-days

        frisby.create('Activity Plan: let another user join this plan')
            .removeHeader('Authorization')
            .auth(consts.users.reto.username, consts.users.reto.password)
            .post(URL + '/activityplans', {
                "owner": consts.users.reto.id,
                "activity": consts.groupActivity3.id,
                "visibility": "public",
                "executionType": "group",
                "mainEvent": {
                    "start": "2014-10-16T12:00:00.000Z",
                    "end": "2014-10-16T13:00:00.000Z",
                    "allDay": false,
                    "frequency": "day",
                    "deleteStatus": "",
                    "recurrence": {
                        "endby": {
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

                frisby.create('Activity Plan: reload masterPlan from server')
                    .auth(consts.users.unittest.username, consts.users.unittest.password)
                    .get(URL + '/activityplans/' + newPlan.id)
                    .expectStatus(200)
                    .afterJSON(function (reloadedNewPlan) {
                        expect(_.indexOf(reloadedNewPlan.joiningUsers, joiningPlan.owner)).not.toEqual(-1);
                        expect(reloadedNewPlan.deleteStatus).toEqual("ACTIVITYPLAN_DELETE_NO");

                        console.log('Server Time: ' + new Date());
                        console.log('Delete Status Reloaded Plan: ' + reloadedNewPlan.deleteStatus + ' -> ID: ' + reloadedNewPlan.id);
                        console.log('Delete Status Plan 2: ' + joiningPlan.deleteStatus + ' -> ID: ' + joiningPlan.id);
                        frisby.create('Activity Plan: delete plan 2')
                            .delete(URL + '/activityplans/' + joiningPlan.id)
                            .expectStatus(200)
                            .auth('sysadm', 'backtothefuture')
                            .after(function() {
                                console.log('Delete Status Plan 1: ' + newPlan.deleteStatus);
                                frisby.create('Activity Plan: delete plan 1')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .auth('sysadm', 'backtothefuture')
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();

                        consts.users.unittest.preferences.workingDays = ['MO', 'TU', 'WE'];

                        frisby.create('Activity Plan: update user preferences to workdays only MO-WE and plan DAILY activity')
                            .put(URL + '/users/' + consts.users.unittest.id, consts.users.unittest)
                            .expectStatus(200)
                            .afterJSON(function(updatedUser) {
                                frisby.create('Activity Plan: plan a daily activity for user only working MO, TU, WE')
                                    .post(URL + '/activityplans', {
                                        "owner": consts.users.unittest.id,
                                        "activity": consts.groupActivity3.id,
                                        "visibility": "public",
                                        "executionType": "group",
                                        "mainEvent": {
                                            "start": moment().add('hours',1).toISOString(),
                                            "end": moment().add('hours', 2).toISOString(),
                                            "allDay": false,
                                            "frequency": "day",
                                            "recurrence": {
                                                "endby": {
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
                                    .afterJSON(function(newPlan) {
                                        _.forEach(newPlan.events, function(event) {
                                            expect(moment(event.begin).day()).not.toEqual(4);
                                            expect(moment(event.begin).day()).not.toEqual(5);
                                            expect(moment(event.begin).day()).not.toEqual(6);
                                            expect(moment(event.begin).day()).not.toEqual(0);
                                        });
                                        console.log(newPlan);

                                        consts.users.unittest.preferences.workingDays = [];

                                        frisby.create('Activity Plan: reset user')
                                            .put(URL + '/users/' + consts.users.unittest.id, consts.users.unittest)
                                            .expectStatus(200)
                                            .toss();


                                        frisby.create('Activity Plan: delete plan 3')
                                            .delete(URL + '/activityplans/' + newPlan.id)
                                            .expectStatus(200)
                                            .toss();

                                    })
                                    .toss();

                            })
                            .toss();



                    }).toss();
            }).toss();
    })
    .toss();

