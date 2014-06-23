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
var URL = BASE_URL + '/activityplans';
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


frisby.create('ActivityPlan Edits: create a single activityPlan with a single event')
    .post(URL, activityPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {

        expect(activityPlanPostAnswer.editStatus).toEqual('editable');
        expect(activityPlanPostAnswer.location).toEqual(initialLocation);
        expect(activityPlanPostAnswer.executionType).toEqual("self");

        activityPlanPostAnswer.location = editedLocation;

        frisby.create('ActivityPlan Edits: update plan with modified location and visibily, id: ' + activityPlanPostAnswer.id)
            .put(URL + '/' + activityPlanPostAnswer.id, activityPlanPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (activityPlanPutAnswer) {
                expect(activityPlanPutAnswer.editStatus).toEqual('editable');
                expect(activityPlanPutAnswer.location).toEqual(editedLocation);

                // now modify it to have more than one event
                activityPlanPutAnswer.mainEvent.frequency = "week";

                frisby.create('ActivityPlan Edits: update plan change frequency to "week", id: ' + activityPlanPutAnswer.id)
                    .put(URL + '/' + activityPlanPutAnswer.id, activityPlanPutAnswer)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (activityPlanPutAnswer2) {
                        expect(activityPlanPutAnswer2.editStatus).toEqual('editable');
                        expect(activityPlanPutAnswer2.deleteStatus).toEqual('deletable');

                        frisby.create('AcitvityPlanEdits: get Events and check them')
                            .get(BASE_URL + '/activityevents?filter[activityPlan]='+activityPlanPutAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .expectJSONLength(6)
                            .after(function() {

                                // delete activityPlan
                                frisby.create('ActivityPlan Edits: delete activityPlan')
                                    .delete(URL + '/' + activityPlanPutAnswer2.id)
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

var activityPlanSingleEventPassed = _.clone(activityPlan, true);
activityPlanSingleEventPassed.mainEvent.start = moment(initialDateStart).subtract('d', 3).toDate();
activityPlanSingleEventPassed.mainEvent.end = moment(initialDateEnd).subtract('d', 3).toDate();

frisby.create('ActivityPlan Edits: create single activityPlan with single event in the past')
    .post(URL, activityPlanSingleEventPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {

        expect(activityPlanPostAnswer.editStatus).toEqual('notEditablePastEvent');

        // now try to modify something even though it is not allowed to update this plan
        activityPlanPostAnswer.mainEvent.frequency = "week";

        frisby.create('ActivityPlan Edits: try to update single activityPlan with single event in the past')
            .put(URL + '/' + activityPlanPostAnswer.id, activityPlanPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(409)
            .afterJSON(function (activityPlanPutAnswer) {

                // cleanup uneditable and undeletable activityPlan
                frisby.create('ActivityPlan Edits: cleanup activityPlan, id: ' + activityPlanPostAnswer.id)
                    .delete(URL + '/' + activityPlanPostAnswer.id)
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();


frisby.create('ActivityPlan Edits: create a single activityPlan with a single event to be used as master plan')
    .post(URL, activityPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {
        expect(activityPlanPostAnswer.editStatus).toEqual('editable');
        // save master plan id for later
        var masterPlanId = activityPlanPostAnswer.id;

        frisby.create('ActivityPlan Edits: post a joining plan ')
            .post(URL + '/'+activityPlanPostAnswer.id +'/join')
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.owner).not.toEqual(consts.users.test_ind2.id);

                // now try to modify something even though it is not allowed to update this joined plan
                slavePlanPostAnswer.mainEvent.frequency = "week";

                frisby.create('ActivityPlan Edits: try to update joined plan, 403')
                    .put(URL + '/' + slavePlanPostAnswer.id, slavePlanPostAnswer)
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .afterJSON(function (activityPlanPutAnswer) {

                        // now try to modify something even though it is not allowed to update this master plan

                        frisby.create('ActivityPlan Edits: reload masterPlan')
                            .get(URL + '/' + masterPlanId)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (masterPlanReloaded) {
                                expect(masterPlanReloaded.editStatus).toEqual('editable');

                                masterPlanReloaded.mainEvent.frequency = "week";

                                frisby.create('ActivityPlan Edits: try to update master plan, id: ' + masterPlanReloaded.id)
                                    .put(URL + '/' + masterPlanReloaded.id, masterPlanReloaded)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (activityPlanPutAnswer) {

                                        frisby.create('ActivityPlan Edits: reload slavePlan, check whether it was updated automaticallly')
                                            .get(URL + '/' + slavePlanPostAnswer.id)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (reloadedSlavePlan) {

                                                expect(reloadedSlavePlan.mainEvent.frequency).toEqual('week');


                                                // cleanup joined activityPlan
                                                frisby.create('ActivityPlan Edits: cleanup master activityPlan, id: ' + masterPlanReloaded.id)
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

frisby.create('ActivityPlan Edits: create a weekly activityPlan with 3 events passed')
    .post(URL, planWeeklyThreeEventsPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (initialPlan) {
        expect(initialPlan.editStatus).toEqual('editable');

        frisby.create('ActivityPlanEdits: getEvents for this plan')
            .get(BASE_URL + '/activityevents?filter[activityPlan]=' + initialPlan.id + '&sort=start')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                var mySecondEvent = events[1];
                mySecondEvent.status = 'missed';

                frisby.create('ActivityPlan Edits: mark second event as missed')
                    .put(BASE_URL + '/activityevents/' + mySecondEvent.id, mySecondEvent)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (savedSecondEvent) {
                        expect(savedSecondEvent.status).toEqual('missed');


                        var postponedTime = moment(initialTime).add(1, 'h').toDate();
                        initialPlan.mainEvent.start = postponedTime;
                        initialPlan.mainEvent.end = moment(postponedTime).add(1, 'h').toDate();

                        // delete the Version information, otherwise mongo complains because we have modified the document with the call before...
                        delete initialPlan.__v;

                        frisby.create('ActivityPlan Edits: update plan, expect only future events to have changed, old events to be preserved')
                            .put(URL + '/' + initialPlan.id, initialPlan)
                            .auth('test_ind1', 'yp')
                            .afterJSON(function (updatedPlan) {
                                expect(updatedPlan.editStatus).toEqual('editable');

                                frisby.create('ActivityPlanEdits: getEvents for this plan, check old events are preserved, new are updated')
                                    .get(BASE_URL + '/activityevents?filter[activityPlan]=' + initialPlan.id + '&sort=start')
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (newEvents) {


                                        expect(events.length).toEqual(6);
                                        expect(moment(newEvents[0].start).toDate()).toEqual(initialTime);
                                        expect(moment(newEvents[2].start).toDate()).toEqual(moment(events[2].start).toDate());
                                        expect(moment(newEvents[3].start).toDate()).toEqual(moment(events[3].start).add(1, 'h').toDate());
                                        expect(moment(newEvents[5].start).toDate()).toEqual(moment(events[5].start).add(1, 'h').toDate());
                                        expect(newEvents[1].status).toEqual('missed');
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
