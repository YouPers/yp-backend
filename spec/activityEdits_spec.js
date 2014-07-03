/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 28.01.14
 * Time: 14:15
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var BASE_URL = 'http://localhost:' + port;
var URL = BASE_URL + '/activities';
var _ = require('lodash');
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

var initialLocation = "initialLocation";
var editedLocation = "editedLocation";
var initialDateStart = moment().add(1, 'd').hour(10).toDate();
var initialDateEnd = moment(initialDateStart).add(1, 'h').toDate();
var intialFrequency = "once";

var activity = {
    "owner": consts.users.test_ind1.id,
    "idea": consts.groupIdea.id,
    "location": initialLocation,
    "visibility": "private",
    "executionType": "self",
    "title": "myTitle",
    "mainEvent": {
        "start": initialDateStart,
        "end": initialDateEnd,
        "allDay": false,
        "frequency": intialFrequency,
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


frisby.create('ActivityEdits: create a single activity with a single event')
    .post(URL, activity)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPostAnswer) {

        expect(activityPostAnswer.editStatus).toEqual('editable');
        expect(activityPostAnswer.location).toEqual(initialLocation);
        expect(activityPostAnswer.executionType).toEqual("self");

        activityPostAnswer.location = editedLocation;

        frisby.create('ActivityEdits: update activity with modified location and visibily, id: ' + activityPostAnswer.id)
            .put(URL + '/' + activityPostAnswer.id, activityPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (activityPutAnswer) {
                expect(activityPutAnswer.editStatus).toEqual('editable');
                expect(activityPutAnswer.location).toEqual(editedLocation);

                // now modify it to have more than one event
                activityPutAnswer.mainEvent.frequency = "week";

                frisby.create('ActivityEdits: update activity change frequency to "week", id: ' + activityPutAnswer.id)
                    .put(URL + '/' + activityPutAnswer.id, activityPutAnswer)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (activityPutAnswer2) {
                        expect(activityPutAnswer2.editStatus).toEqual('editable');
                        expect(activityPutAnswer2.deleteStatus).toEqual('deletable');

                        frisby.create('AcitvityPlanEdits: get Events and check them')
                            .get(BASE_URL + '/activityevents?filter[activity]='+activityPutAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .expectJSONLength(6)
                            .after(function() {

                                // delete activity
                                frisby.create('Activity Edits: delete activity')
                                    .delete(URL + '/' + activityPutAnswer2.id)
                                    .auth('test_ind1', 'yp')
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

var activitySingleEventPassed = _.clone(activity, true);
activitySingleEventPassed.mainEvent.start = moment(initialDateStart).subtract('d', 3).toDate();
activitySingleEventPassed.mainEvent.end = moment(initialDateEnd).subtract('d', 3).toDate();

frisby.create('Activity Edits: create single activity with single event in the past')
    .post(URL, activitySingleEventPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPostAnswer) {

        expect(activityPostAnswer.editStatus).toEqual('notEditablePastEvent');

        // now try to modify something even though it is not allowed to update this actvity
        activityPostAnswer.mainEvent.frequency = "week";

        frisby.create('ActivityEdits: try to update single activity with single event in the past')
            .put(URL + '/' + activityPostAnswer.id, activityPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(409)
            .afterJSON(function (activityPutAnswer) {

                // cleanup uneditable and undeletable activity
                frisby.create('ActivityEdits: cleanup activity, id: ' + activityPostAnswer.id)
                    .delete(URL + '/' + activityPostAnswer.id)
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();


frisby.create('ActivityEdits: create a single activity with a single event to be used as a joinable activity')
    .post(URL, activity)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPostAnswer) {
        expect(activityPostAnswer.editStatus).toEqual('editable');

        frisby.create('ActivityEdits: post a join')
            .post(URL + '/'+activityPostAnswer.id +'/join')
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.owner).not.toEqual(consts.users.test_ind2.id);

                // now try to modify something even though it is not allowed to update this joined activity
                slavePlanPostAnswer.mainEvent.frequency = "week";

                frisby.create('ActivityEdits: try to update activity as a joiner, 403')
                    .put(URL + '/' + slavePlanPostAnswer.id, slavePlanPostAnswer)
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .afterJSON(function (activityPutAnswer) {

                        // now try to modify something even though it is not allowed to update this master activity

                        frisby.create('ActivityEdits: reload masterActivity')
                            .get(URL + '/' + activityPostAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (masterActivityReloaded) {
                                expect(masterActivityReloaded.editStatus).toEqual('editable');

                                masterActivityReloaded.mainEvent.frequency = "week";

                                frisby.create('ActivityEdits: try to update master activity, id: ' + masterActivityReloaded.id)
                                    .put(URL + '/' + masterActivityReloaded.id, masterActivityReloaded)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (activityPutAnswer) {

                                        frisby.create('ActivityEdits: reload slavePlan, check whether it was updated automaticallly')
                                            .get(URL + '/' + slavePlanPostAnswer.id)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (reloadedSlavePlan) {

                                                expect(reloadedSlavePlan.mainEvent.frequency).toEqual('week');


                                                // cleanup joined activity
                                                frisby.create('ActivityEdits: cleanup master activity, id: ' + masterActivityReloaded.id)
                                                    .delete(URL + '/' + masterActivityReloaded.id)
                                                    .auth('sysadm', 'backtothefuture')
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

            })
            .toss();

    })
    .toss();

var planWeeklyThreeEventsPassed = _.clone(activity, true);
var initialTime = moment().subtract('w', 3).add('h', 3).toDate();
planWeeklyThreeEventsPassed.mainEvent.start = initialTime;
planWeeklyThreeEventsPassed.mainEvent.end = moment(initialTime).add('h', 1).toDate();
planWeeklyThreeEventsPassed.mainEvent.frequency = 'week';

frisby.create('ActivityEdits: create a weekly activity with 3 events passed')
    .post(URL, planWeeklyThreeEventsPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (initialActivity) {
        expect(initialActivity.editStatus).toEqual('editable');

        frisby.create('ActivityEdits: getEvents for this activity')
            .get(BASE_URL + '/activityevents?filter[activity]=' + initialActivity.id + '&sort=start')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                var mySecondEvent = events[1];
                mySecondEvent.status = 'missed';

                frisby.create('ActivityEdits: mark second event as missed')
                    .put(BASE_URL + '/activityevents/' + mySecondEvent.id, mySecondEvent)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (savedSecondEvent) {
                        expect(savedSecondEvent.status).toEqual('missed');


                        var postponedTime = moment(initialTime).add(1, 'h').toDate();
                        initialActivity.mainEvent.start = postponedTime;
                        initialActivity.mainEvent.end = moment(postponedTime).add(1, 'h').toDate();

                        // delete the Version information, otherwise mongo complains because we have modified the document with the call before...
                        delete initialActivity.__v;

                        frisby.create('Activity Edits: update activity, expect only future events to have changed, old events to be preserved')
                            .put(URL + '/' + initialActivity.id, initialActivity)
                            .auth('test_ind1', 'yp')
                            .afterJSON(function (updatedActivity) {
                                expect(updatedActivity.editStatus).toEqual('editable');

                                frisby.create('ActivityEdits: getEvents for this activity, check old events are preserved, new are updated')
                                    .get(BASE_URL + '/activityevents?filter[activity]=' + initialActivity.id + '&sort=start')
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (newEvents) {


                                        expect(events.length).toEqual(6);
                                        expect(moment(newEvents[0].start).toDate()).toEqual(initialTime);
                                        expect(moment(newEvents[2].start).toDate()).toEqual(moment(events[2].start).toDate());
                                        expect(moment(newEvents[3].start).toDate()).toEqual(moment(events[3].start).add(1, 'h').toDate());
                                        expect(moment(newEvents[5].start).toDate()).toEqual(moment(events[5].start).add(1, 'h').toDate());
                                        expect(newEvents[1].status).toEqual('missed');

                                        // cleanup joined activity
                                        frisby.create('Activity Edits: cleanup updatedPlan, id: ' + updatedActivity.id)
                                            .delete(URL + '/' + updatedActivity.id)
                                            .auth('sysadm', 'backtothefuture')
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
    })
    .toss();
