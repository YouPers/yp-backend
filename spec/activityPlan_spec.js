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

// set the startDate in the future and ensure that it is a Wednesday
var startDate = moment().add('d', 5).day(4).startOf('hour').toDate();
var endDate = moment(startDate).add('h', 1).toDate();

frisby.create('ActivityPlan: plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind1.id,
        "idea": consts.groupIdea.id,
        "title": "myTitle",
        "visibility": "public",
        "campaign": "527916a82079aa8704000006",
        "executionType": "group",
        "mainEvent": {
            "start": startDate,
            "end": endDate,
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();
        frisby.create('ActivityPlan: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(events.length).toEqual(1);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);
                frisby.create('ActivityPlan: GET this activityPlan by Id und check whether it is there')
                    .get(URL + '/activityplans/' + newPlan.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .expectJSON({
                        id: newPlan.id,
                        idea: consts.groupIdea.id
                    })
                    .afterJSON(function (plan) {
                        frisby.create('ActivityPlan: GET all activityplans and check whether the created one is in the returned list')
                            .get(URL + '/activityplans')
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .expectJSON('*', {
                                id: String,
                                idea: String
                            })
                            .afterJSON(function (plans) {

                                expect(_.find(plans, function (plan) {
                                    return (plan.id === newPlan.id);
                                })).toBeDefined();

                                frisby.create('ActivityPlan: delete the created activityPlan again')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('ActivityPlan: GET this activityPlan by Id again und check whether it is not there anymore')
                                            .get(URL + '/activityplans/' + newPlan.id)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(404)
                                            .toss();


                                        frisby.create('ActivityPlan: GET all activityplans again and check whether the plan has really been deleted')
                                            .get(URL + '/activityplans')
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .expectJSON('*', {
                                                id: String,
                                                idea: String
                                            })
                                            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
                                            .afterJSON(function (plans) {
                                                expect(_.find(plans, function (plan) {
                                                    return (plan.id === newPlan.id);
                                                })).toBeUndefined();
                                            })
                                            .toss();

                                        frisby.create('ActivityPlan: get Events and check whether they are gone')
                                            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (events) {
                                                expect(events.length).toEqual(0);
                                            })
                                            .toss();
                                    })
                                    .toss();
                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();

    })

    .toss();


frisby.create('ActivityPlan: plan weekly activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind2.id,
        "idea": "5278c6adcdeab69a2500001e",
        "visibility": "public",
        "campaign": "527916a82079aa8704000006",
        "title": "myTitle",
        "executionType": "group",
        "mainEvent": {
            "start": startDate,
            "end": endDate,
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
        expect(newPlan.joiningUsers).toMatchOrBeEmpty();

        frisby.create('ActivityPlan: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(events.length).toEqual(6);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                frisby.create('ActivityPlan: delete the created activityPlan again')
                    .delete(URL + '/activityplans/' + newPlan.id)
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();

frisby.create('ActivityPlan: plan daily activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind3.id,
        "idea": consts.groupIdea.id,
        "title": "myTitle",
        "campaign": "527916a82079aa8704000006",
        "executionType": "group",
        "mainEvent": {
            "start": startDate,
            "end": endDate,
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

        frisby.create('ActivityPlan: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
            .auth('test_ind3', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(events.length).toEqual(6);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                frisby.create('ActivityPlan: let another user join this plan')
                    .post(URL + '/activityplans/' + newPlan.id + '/join')
                    .auth('test_ind1', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (joinedPlan) {
                        frisby.create('ActivityPlan: get Events and check whether correctly generated')
                            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (events) {
                                expect(events.length).toEqual(6);
                                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                                frisby.create('ActivityPlan: try to delete plan as joiningUser, partial SUCCESS, only his events are gone')
                                    .delete(URL + '/activityplans/' + newPlan.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('ActivityPlan: try to get the left plan as ex-joiningUser, FAIL')
                                            .get(URL + '/activityplans/' + newPlan.id)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(403)
                                            .after(function () {


                                                frisby.create('ActivityPlan: delete the created activityPlan as organizer, SUCCESS')
                                                    .delete(URL + '/activityplans/' + newPlan.id)
                                                    .auth('test_ind3', 'yp')
                                                    .expectStatus(200)
                                                    .after(function () {

                                                        frisby.create('ActivityPlan: get Events and check whether events are deleted')
                                                            .get(URL + '/activityevents?filter[activityPlan]=' + newPlan.id)
                                                            .auth('test_ind1', 'yp')
                                                            .expectStatus(200)
                                                            .expectJSONLength(0)
                                                            .toss();
                                                    })
                                                    .toss();
                                            })
                                            .toss();
                                    })
                                    .toss();

                            })
                            .toss();
                    })
                    .toss();

            })
            .toss();
    })
    .toss();


var profileUpdate = {
    prefs: {
        defaultWorkWeek: ["MO", "TU", "WE"],
        "calendarNotification": "900",
        "email": {
            "actPlanInvites": true,
            "dailyUserMail": false,
            "iCalInvites": false
        },
        "rejectedIdeas": [],
        "rejectedActivityPlans": [],
        "starredIdeas": []
    }
};

frisby.create('ActivityPlan: update user profile preferences to workdays only MO-WE and plan DAILY activity')
    .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate)
    .auth('test_ind1', 'yp')
    .expectStatus(200)
    .afterJSON(function (updatedUser) {
        frisby.create('ActivityPlan: plan a daily activity for user only working MO, TU, WE')
            .post(URL + '/activityplans', {
                "owner": consts.users.test_ind1.id,
                "idea": consts.groupIdea.id,
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
                    prefs: {
                        "calendarNotification": "900",
                        "defaultWorkWeek": ["MO", "TU", "WE", "TH", "FR"],
                        "email": {
                            "actPlanInvites": true,
                            "dailyUserMail": false,
                            "iCalInvites": false
                        },
                        "rejectedIdeas": [],
                        "rejectedActivityPlans": [],
                        "starredIdeas": []
                    }
                };

                frisby.create('ActivityPlan: reset user')
                    .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate2)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();


                frisby.create('ActivityPlan: delete plan 3')
                    .delete(URL + '/activityplans/' + newPlan.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

            })
            .toss();

    })
    .toss();



