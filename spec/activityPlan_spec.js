var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

frisby.create('Activity Plan: plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind1.id,
        "activity": consts.groupActivity.id,
        "title": "myTitle",
        "visibility": "public",
        "campaign": "527916a82079aa8704000006",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-06-16T12:00:00.000Z",
            "end": "2014-06-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(1);
        expect(newPlan.events[0].begin).toEqual('2014-06-16T12:00:00.000Z');
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();
        expect(newPlan.masterPlan).not.toBeDefined();

        frisby.create('Activity Plan: GET this activity plan by Id und check whether it is there')
            .get(URL + '/activityplans/' + newPlan.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .expectJSON({
                id: newPlan.id,
                activity: consts.groupActivity.id
            })
            .toss();

        frisby.create('Activity Plan: GET all activityplans and check whether the created one is in the returned list')
            .get(URL + '/activityplans')
            .auth('test_ind1', 'yp')
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
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('Activity Plan: GET this activity plan by Id again und check whether it is not there anymore')
                            .get(URL + '/activityplans/' + newPlan.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(404)
                            .toss();


                        frisby.create('Activity Plan: GET all activityplans again and check whether the plan has really been deleted')
                            .get(URL + '/activityplans')
                            .auth('test_ind1', 'yp')
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
        "owner": consts.users.test_ind2.id,
        "activity": "5278c6adcdeab69a2500001e",
        "visibility": "public",
        "campaign": "527916a82079aa8704000006",
        "title": "myTitle",
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
    .auth('test_ind2', 'yp')
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
            .put(URL + '/activityplans/' + newPlan.id + '/events/' + newPlan.events[0].id, {feedback: 5, status: 'done'}, {json: true})
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function (updatedEvent) {
                expect(updatedEvent.feedback).toEqual(5);
                expect(updatedEvent.status).toEqual('done');

                frisby.create('Activity Plan: Get plan again and check whether feedback is updated')
                    .get(URL + '/activityplans/' + newPlan.id)
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (reloadedPlan) {
                        expect(reloadedPlan.events[0].feedback).toEqual(5);
                        expect(reloadedPlan.events[0].status).toEqual('done');
                        frisby.create('Activity Plan: update Events again, reset feedback, add comment')
                            .put(URL + '/activityplans/' + reloadedPlan.id + '/events/' + reloadedPlan.events[0].id,
                            {"feedback": "2", "comment": "new Text from UnitTest"}, {json: true})
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                expect(newUpdatedEvent.comment).toEqual("new Text from UnitTest");
                                expect(newUpdatedEvent.feedback).toEqual(2);
                                frisby.create('Activity Plan: delete again')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();
    })
    .toss();

frisby.create('Activity Plan: plan daily activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind3.id,
        "activity": consts.groupActivity.id,
        "visibility": "public",
        "title": "myTitle",
        "campaign": "527916a82079aa8704000006",
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
    .auth('test_ind3', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.events).toBeDefined();
        expect(newPlan.events.length).toEqual(6);
        expect(newPlan.events[0].end).toEqual('2014-10-16T13:00:00.000Z');
        expect(newPlan.events[5].end).toEqual('2014-10-23T13:00:00.000Z');  //skipping the two weekend-days

        frisby.create('Activity Plan: let another user join this plan')
            .post(URL + '/activityplans', {
                "owner": consts.users.test_ind2.id,
                "activity": consts.groupActivity.id,
                "visibility": "public",
                "executionType": "group",
                "campaign": "527916a82079aa8704000006",
                "title": "myTitle",
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
                "status": "active",
                "masterPlan": newPlan.id
            }
        )
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (joiningPlan) {
                expect(joiningPlan.masterPlan).toEqual(newPlan.id);

                frisby.create('Activity Plan: reload masterPlan from server')
                    .get(URL + '/activityplans/' + newPlan.id)
                    .auth('test_ind3', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (reloadedNewPlan) {
                        expect(_.indexOf(reloadedNewPlan.joiningUsers, joiningPlan.owner)).not.toEqual(-1);
                        expect(reloadedNewPlan.deleteStatus).toEqual("deletable");

                        frisby.create('Activity Plan: delete plan 2')
                            .delete(URL + '/activityplans/' + joiningPlan.id)
                            .auth('sysadm', 'backtothefuture')
                            .expectStatus(200)
                            .after(function () {
                                frisby.create('Activity Plan: delete plan 1')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .auth('sysadm', 'backtothefuture')
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();

                        var profileUpdate = {
                            userPreferences: {
                                defaultUserWeekForScheduling: {
                                    monday: true,
                                    tuesday: true,
                                    wednesday: true,
                                    thursday: false,
                                    friday: false,
                                    saturday: false,
                                    sunday: false
                                }
                            }
                        };

                        frisby.create('Activity Plan: update user profile preferences to workdays only MO-WE and plan DAILY activity')
                            .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (updatedUser) {
                                frisby.create('Activity Plan: plan a daily activity for user only working MO, TU, WE')
                                    .post(URL + '/activityplans', {
                                        "owner": consts.users.test_ind1.id,
                                        "activity": consts.groupActivity.id,
                                        "visibility": "public",
                                        "title": "myTitle",
                                        "campaign": "527916a82079aa8704000006",
                                        "executionType": "group",
                                        "mainEvent": {
                                            "start": moment().day(2).add('hours', 1).toISOString(),
                                            "end": moment().day(2).add('hours', 2).toISOString(),
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
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (newPlan) {
                                        _.forEach(newPlan.events, function (event) {
                                            expect(moment(event.begin).day()).not.toEqual(4);
                                            expect(moment(event.begin).day()).not.toEqual(5);
                                            expect(moment(event.begin).day()).not.toEqual(6);
                                            expect(moment(event.begin).day()).not.toEqual(0);
                                        });

                                        var profileUpdate2 = {
                                            userPreferences: {
                                                defaultUserWeekForScheduling: {
                                                    monday: true,
                                                    tuesday: true,
                                                    wednesday: true,
                                                    thursday: true,
                                                    friday: true,
                                                    saturday: false,
                                                    sunday: false
                                                }
                                            }
                                        };

                                        frisby.create('Activity Plan: reset user')
                                            .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate2)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .toss();


                                        frisby.create('Activity Plan: delete plan 3')
                                            .delete(URL + '/activityplans/' + newPlan.id)
                                            .auth('test_ind1', 'yp')
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

