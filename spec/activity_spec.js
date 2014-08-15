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
var startDate = moment().add(10, 'd').day(4).startOf('hour').toDate();
var endDate = moment(startDate).add(1, 'h').toDate();

frisby.create('Activity: plan once activity and check whether event is generated')
    .post(URL + '/activities', {
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
        frisby.create('Activity: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(events.length).toEqual(1);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);
                frisby.create('Activity: GET this activity by Id und check whether it is there')
                    .get(URL + '/activities/' + newPlan.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .expectJSON({
                        id: newPlan.id,
                        idea: consts.groupIdea.id
                    })
                    .afterJSON(function (plan) {
                        frisby.create('Activity: GET all activities and check whether the created one is in the returned list')
                            .get(URL + '/activities')
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

                                frisby.create('Activity: delete the created activity again')
                                    .delete(URL + '/activities/' + newPlan.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('Activity: GET this activity by Id again und check whether it is not there anymore')
                                            .get(URL + '/activities/' + newPlan.id)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(404)
                                            .toss();


                                        frisby.create('Activity: GET all activities again and check whether the plan has really been deleted')
                                            .get(URL + '/activities')
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

                                        frisby.create('Activity: get Events and check whether they are gone')
                                            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
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


frisby.create('Activity: plan weekly activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activities', {
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

        frisby.create('Activity: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(events[0].owner).toEqual(consts.users.test_ind2.id);
                expect(events[5].owner).toEqual(consts.users.test_ind2.id);
                expect(events.length).toEqual(6);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                frisby.create('Activity: delete the created activity again')
                    .delete(URL + '/activities/' + newPlan.id)
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();

var planPost = {
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
};

frisby.create('Activity: plan daily activity and check whether events are generated, with EndBy: after 6')
    .post(URL + '/activities', planPost)
    .auth('test_ind3', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {

        frisby.create('Activity: get Events and check whether correctly generated')
            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
            .auth('test_ind3', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
//                console.log(planPost);
//                console.log('start');
//                console.log(moment(events[0].start).format());
//                console.log(moment(startDate).format());

                expect(events.length).toEqual(6);
                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                frisby.create('Activity: let another user join this activity')
                    .post(URL + '/activities/' + newPlan.id + '/join')
                    .auth('test_ind1', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (joinedPlan) {
                        frisby.create('Activity: get Events and check whether correctly generated')
                            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (events) {
                                expect(events.length).toEqual(6);
                                expect(moment(events[0].start).isSame(moment(startDate))).toBe(true);
                                expect(moment(events[0].end).isSame(moment(endDate))).toBe(true);

                                frisby.create('Activity: try to delete activity as joiningUser, partial SUCCESS, only his events are gone')
                                    .delete(URL + '/activities/' + newPlan.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('Activity: try to get the activity as the ex-joiningUser, FAIL')
                                            .get(URL + '/activities/' + newPlan.id)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(403)
                                            .after(function () {


                                                frisby.create('Activity: delete the created activity as organizer, SUCCESS')
                                                    .delete(URL + '/activities/' + newPlan.id)
                                                    .auth('test_ind3', 'yp')
                                                    .expectStatus(200)
                                                    .after(function () {

                                                        frisby.create('Activity: get Events and check whether events are deleted')
                                                            .get(URL + '/activityevents?filter[activity]=' + newPlan.id + '&sort=start')
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
        "rejectedActivities": [],
        "starredIdeas": []
    }
};

frisby.create('Activity: update user profile preferences to workdays only MO-WE and plan DAILY activity')
    .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate)
    .auth('test_ind1', 'yp')
    .expectStatus(200)
    .afterJSON(function (updatedUser) {
        frisby.create('Activity: plan a daily activity for user only working MO, TU, WE')
            .post(URL + '/activities', {
                "owner": consts.users.test_ind1.id,
                "idea": consts.groupIdea.id,
                "visibility": "public",
                "title": "myTitle",
                "campaign": "527916a82079aa8704000006",
                "executionType": "group",
                "mainEvent": {
                    "start": moment().add(1, 'w').day(2).add(1, 'hours').toISOString(),
                    "end": moment().add(1, 'w').day(2).add(2, 'hours').toISOString(),
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
                        "rejectedActivities": [],
                        "starredIdeas": []
                    }
                };

                frisby.create('Activity: reset user')
                    .put(URL + '/profiles/' + consts.users.test_ind1.profile, profileUpdate2)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();


                frisby.create('Activity: delete activity 3')
                    .delete(URL + '/activities/' + newPlan.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

            })
            .toss();

    })
    .toss();



