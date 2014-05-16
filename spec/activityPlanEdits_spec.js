/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 28.01.14
 * Time: 14:15
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activityplans';
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

var activityPlan = {
    "owner": consts.users.test_ind1.id,
    "activity": consts.groupActivity.id,
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


frisby.create('Activity Plan Edits: create a single activity plan with a single event')
    .auth('test_ind1', 'yp')
    .post(URL, activityPlan)
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {

        expect(activityPlanPostAnswer.editStatus).toEqual('editable');
        expect(activityPlanPostAnswer.location).toEqual(initialLocation);
        expect(activityPlanPostAnswer.visibility).toEqual("private");
        expect(activityPlanPostAnswer.executionType).toEqual("self");
        expect(activityPlanPostAnswer.events.length).toEqual(1);

        activityPlanPostAnswer.location = editedLocation;

        frisby.create('Activity Plan Edits: update plan with modified location and visibily, id: ' + activityPlanPostAnswer.id)
            .auth('test_ind1', 'yp')
            .put(URL + '/' + activityPlanPostAnswer.id, activityPlanPostAnswer)
            .expectStatus(200)
            .afterJSON(function (activityPlanPutAnswer) {
                expect(activityPlanPutAnswer.editStatus).toEqual('editable');
                expect(activityPlanPutAnswer.location).toEqual(editedLocation);
                expect(activityPlanPutAnswer.events.length).toEqual(1);

                // now modify it to have more than one event
                activityPlanPutAnswer.mainEvent.frequency = "week";

                frisby.create('Activity Plan Edits: update plan change frequency to "week", id: ' + activityPlanPutAnswer.id)
                    .auth('test_ind1', 'yp')
                    .put(URL + '/' + activityPlanPutAnswer.id, activityPlanPutAnswer)
                    .expectStatus(200)
                    .afterJSON(function (activityPlanPutAnswer2) {
                        expect(activityPlanPutAnswer2.editStatus).toEqual('editable');
                        expect(activityPlanPutAnswer2.deleteStatus).toEqual('deletable');
                        expect(activityPlanPutAnswer2.events.length).toEqual(6);

                        // delete activity plan
                        frisby.create('Activity Plan Edits: delete activity plan')
                            .auth('test_ind1', 'yp')
                            .delete(URL + '/' + activityPlanPutAnswer2.id)
                            .expectStatus(200)
                            .toss();
                    })
                    .toss();
            })
            .toss();
    })
    .toss();

var activityPlanSingleEventPassed = _.clone(activityPlan, true);
activityPlanSingleEventPassed.mainEvent.start = moment(initialDateStart).subtract('d', 3).toDate();
activityPlanSingleEventPassed.mainEvent.end = moment(initialDateEnd).subtract('d', 3).toDate();

frisby.create('Activity Plan Edits: create single activity plan with single event in the past')
    .auth('test_ind1', 'yp')
    .post(URL, activityPlanSingleEventPassed)
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {

        expect(activityPlanPostAnswer.editStatus).toEqual('notEditablePastEvent');

        // now try to modify something even though it is not allowed to update this plan
        activityPlanPostAnswer.mainEvent.frequency = "week";

        frisby.create('Activity Plan Edits: try to update single activity plan with single event in the past')
            .put(URL + '/' + activityPlanPostAnswer.id, activityPlanPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(409)
            .afterJSON(function (activityPlanPutAnswer) {

                // cleanup uneditable and undeletable activity plan
                frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + activityPlanPostAnswer.id)
                    .delete(URL + '/' + activityPlanPostAnswer.id)
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();


frisby.create('Activity Plan Edits: create a single activity plan with a single event to be used as master plan')
    .post(URL, activityPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {
        expect(activityPlanPostAnswer.editStatus).toEqual('editable');
        // save master plan id for later
        var masterPlanId = activityPlanPostAnswer.id;

        // create a slave Plan for this masterPlan
        var slavePlan = activityPlanPostAnswer;
        slavePlan.masterPlan = activityPlanPostAnswer.id;
        delete slavePlan.id;
        delete slavePlan.events;
        delete slavePlan.joiningUsers;
        slavePlan.owner = consts.users.test_ind2.id;

        frisby.create('Activity Plan Edits: post a joining plan ')
            .auth('test_ind2', 'yp')
            .post(URL + '?populate=joiningUsers', slavePlan)
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.editStatus).toEqual('notEditableJoinedPlan');

                // save joined plan id for later
                var joinedPlanId = slavePlanPostAnswer.id;

                // now try to modify something even though it is not allowed to update this joined plan
                slavePlan = slavePlanPostAnswer;
                slavePlan.mainEvent.frequency = "week";

                frisby.create('Activity Plan Edits: try to update joined plan, 409')
                    .auth('test_ind2', 'yp')
                    .put(URL + '/' + slavePlanPostAnswer.id, slavePlan)
                    .expectStatus(409)
                    .afterJSON(function (activityPlanPutAnswer) {

                        // now try to modify something even though it is not allowed to update this master plan

                        frisby.create('Activity Plan Edits: reload masterPlan')
                            .auth('test_ind1', 'yp')
                            .get(URL + '/' + masterPlanId)
                            .expectStatus(200)
                            .afterJSON(function (masterPlanReloaded) {
                                expect(masterPlanReloaded.editStatus).toEqual('editable');

                                masterPlanReloaded.mainEvent.frequency = "week";

                                frisby.create('Activity Plan Edits: try to update master plan, id: ' + masterPlanReloaded.id)
                                    .auth('test_ind1', 'yp')
                                    .put(URL + '/' + masterPlanReloaded.id, masterPlanReloaded)
                                    .expectStatus(200)
                                    .afterJSON(function (activityPlanPutAnswer) {

                                        frisby.create('Activity Plan Edits: reload slavePlan, check whether it was updated automaticallly')
                                            .auth('test_ind2', 'yp')
                                            .get(URL + '/' + slavePlanPostAnswer.id)
                                            .expectStatus(200)
                                            .afterJSON(function (reloadedSlavePlan) {

                                                expect(reloadedSlavePlan.mainEvent.frequency).toEqual('week');

                                                // cleanup uneditable joined activity plan
                                                frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + joinedPlanId)
                                                    .delete(URL + '/' + joinedPlanId)
                                                    .auth('sysadm', 'backtothefuture')
                                                    .expectStatus(200)
                                                    .toss();

                                                // cleanup joined activity plan
                                                frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + masterPlanReloaded.id)
                                                    .delete(URL + '/' + masterPlanReloaded.id)
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

var planWeeklyThreeEventsPassed = _.clone(activityPlan, true);
var initialTime = moment().subtract('w', 3).add('h', 3).toDate();
planWeeklyThreeEventsPassed.mainEvent.start = initialTime;
planWeeklyThreeEventsPassed.mainEvent.end = moment(initialTime).add('h', 1).toDate();
planWeeklyThreeEventsPassed.mainEvent.frequency = 'week';

frisby.create('Activity Plan Edits: create a weekly activity plan with 3 events passed')
    .post(URL, planWeeklyThreeEventsPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (initialPlan) {
        expect(initialPlan.editStatus).toEqual('editable');
        expect(initialPlan.events.length).toEqual(6);

        var mySecondEvent = initialPlan.events[1];
        mySecondEvent.status = 'missed';

        frisby.create('Activity Plan Edits: mark second event as missed')
            .put(URL + '/' + initialPlan.id + '/events/' + mySecondEvent.id, mySecondEvent)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (savedSecondEvent) {
                expect(savedSecondEvent.status).toEqual('missed');


                var postponedTime = moment(initialTime).add(1, 'h').toDate();
                initialPlan.mainEvent.start = postponedTime;
                initialPlan.mainEvent.end = moment(postponedTime).add(1, 'h').toDate();

                // delete the Version information, otherwise mongo complains because we have modified the document with the call before...
                delete initialPlan.__v;

                frisby.create('Activity Plan Edits: update plan, expect only future events to have changed, old events to be preserved')
                    .auth('test_ind1', 'yp')
                    .put(URL + '/' + initialPlan.id, initialPlan)
                    .afterJSON(function (updatedPlan) {
                        expect(updatedPlan.editStatus).toEqual('editable');
                        expect(updatedPlan.events.length).toEqual(6);
                        expect(moment(updatedPlan.events[0].begin).toDate()).toEqual(initialTime);
                        expect(moment(updatedPlan.events[2].begin).toDate()).toEqual(moment(initialPlan.events[2].begin).toDate());
                        expect(moment(updatedPlan.events[3].begin).toDate()).toEqual(moment(initialPlan.events[3].begin).add(1, 'h').toDate());
                        expect(moment(updatedPlan.events[5].begin).toDate()).toEqual(moment(initialPlan.events[5].begin).add(1, 'h').toDate());
                        expect(updatedPlan.events[1].status).toEqual('missed');
                    })
                    .toss();
            })
            .toss();
    })
    .toss();
