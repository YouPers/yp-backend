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

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var activityPlan = {
    "owner": consts.users.test_ind1.id,
    "activity": consts.groupActivity.id,
    "location": "",         // set afterward within the specific test cases
    "visibility": "",       // set afterward within the specific test cases
    "executionType": "",    // set afterward within the specific test cases
    "mainEvent": {
        "start": "",        // set afterward within the specific test cases
        "end": "",          // set afterward within the specific test cases
        "allDay": false,
        "frequency": "",    // set afterward within the specific test cases
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


// test single activity plan with single event in the future
var testLocation = "Lachen";
var testVisibility = "private";
var testExecutionType = "self";

activityPlan.location = testLocation;
activityPlan.visibility = testVisibility;
activityPlan.executionType = testExecutionType;
var dateStart = new Date();
dateStart.setDate(dateStart.getDate()+1);
dateStart.setHours(10);
var dateEnd = new Date();
dateEnd.setDate(dateEnd.getDate()+1);
dateEnd.setHours(11);
activityPlan.mainEvent.start = dateStart;
activityPlan.mainEvent.end = dateEnd;
activityPlan.mainEvent.frequency = "once";

frisby.create('Activity Plan Edits: create a single activity plan with a single event')
    .auth('test_ind1', 'yp')
    .post(URL, activityPlan)
    .expectStatus(201)
    .afterJSON(function (activityPlanPostAnswer) {

        var activityPlanId = activityPlanPostAnswer.id;

        expect(activityPlanPostAnswer.editStatus).toEqual('editable');
        expect(activityPlanPostAnswer.location).toEqual(testLocation);
        expect(activityPlanPostAnswer.visibility).toEqual(testVisibility);
        expect(activityPlanPostAnswer.executionType).toEqual(testExecutionType);
        expect(activityPlanPostAnswer.events.length).toEqual(1);

        var editedPlan = activityPlanPostAnswer;

        // now change some attributes
        testLocation = "Los Feliz";
        testVisibility = "public";

        editedPlan.location = testLocation;
        editedPlan.visibility = testVisibility;

        frisby.create('Activity Plan Edits: update plan with modified location and visibily, id: ' + activityPlanPostAnswer.id)
            .auth('test_ind1', 'yp')
            .put(URL + '/' + activityPlanPostAnswer.id, {
                "location": testLocation,
                "visibility": testVisibility
            })
            .expectStatus(201)
            .afterJSON(function (activityPlanPutAnswer) {
                expect(activityPlanPutAnswer.editStatus).toEqual('editable');
                expect(activityPlanPutAnswer.location).toEqual(testLocation);
                expect(activityPlanPutAnswer.visibility).toEqual(testVisibility);
                expect(activityPlanPutAnswer.events.length).toEqual(1);

                editedPlan = activityPlanPutAnswer;

                // now modify it to have more than one event
                editedPlan.mainEvent.frequency = "week";

                console.log (editedPlan.mainEvent.start);
                console.log (editedPlan.mainEvent.end);

                frisby.create('Activity Plan Edits: update plan with more than one event, id: ' + activityPlanPutAnswer.id)
                    .auth('test_ind1', 'yp')
                    .put(URL + '/' + activityPlanPutAnswer.id, editedPlan)
                    .expectStatus(201)
                    .afterJSON(function (activityPlanPutAnswer2) {
                        expect(activityPlanPutAnswer2.editStatus).toEqual('notEditableNotSingleEvent');
                        expect(activityPlanPutAnswer2.deleteStatus).toEqual('deletable');
                        expect(activityPlanPutAnswer2.events.length).toEqual(6);

                        // delete activity plan
                        frisby.create('Activity Plan Edits: delete activity plan')
                            .auth('test_ind1', 'yp')
                            .delete(URL + '/' + activityPlanPutAnswer2.id)
                            .expectStatus(200)
                            .toss();

                        // test single activity plan with single event in the past
                        testLocation = "Lachen";
                        testVisibility = "private";
                        testExecutionType = "self";

                        activityPlan.location = testLocation;
                        activityPlan.visibility = testVisibility;
                        activityPlan.executionType = testExecutionType;
                        var dateStart = new Date();
                        dateStart.setDate(dateStart.getDate()-5);
                        dateStart.setHours(10);
                        var dateEnd = new Date();
                        dateEnd.setDate(dateEnd.getDate()-5);
                        dateEnd.setHours(11);
                        activityPlan.mainEvent.start = dateStart;
                        activityPlan.mainEvent.end = dateEnd;
                        activityPlan.mainEvent.frequency = "once";
                        frisby.create('Activity Plan Edits: create a single activity plan with a single event')
                            .auth('test_ind1', 'yp')
                            .post(URL, activityPlan)
                            .expectStatus(201)
                            .afterJSON(function (activityPlanPostAnswer) {

                                var activityPlanId = activityPlanPostAnswer.id;

                                expect(activityPlanPostAnswer.editStatus).toEqual('notEditablePastEvent');

                                editedPlan = activityPlanPostAnswer;

                                // now try to modify something even though it is not allowed to update this plan
                                editedPlan.mainEvent.frequency = "week";

                                frisby.create('Activity Plan Edits: try to update plan with more than one event, id: ' + activityPlanPostAnswer.id)
                                    .put(URL + '/' + activityPlanPostAnswer.id, editedPlan)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(405)
                                    .afterJSON(function (activityPlanPutAnswer) {

                                        // cleanup uneditable and undeletable activity plan
                                        frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + activityPlanPostAnswer.id)
                                            .delete(URL + '/' + activityPlanPostAnswer.id)
                                            .auth('sysadm','backtothefuture')
                                            .expectStatus(200)
                                            .toss();

                                        // test uneditable master plan
                                        testLocation = "Lachen";
                                        testVisibility = "private";
                                        testExecutionType = "group";

                                        activityPlan.location = testLocation;
                                        activityPlan.visibility = testVisibility;
                                        activityPlan.executionType = testExecutionType;
                                        var dateStart = new Date();
                                        dateStart.setDate(dateStart.getDate()+1);
                                        dateStart.setHours(10);
                                        var dateEnd = new Date();
                                        dateEnd.setDate(dateEnd.getDate()+1);
                                        dateEnd.setHours(11);
                                        activityPlan.mainEvent.start = dateStart;
                                        activityPlan.mainEvent.end = dateEnd;
                                        activityPlan.mainEvent.frequency = "once";
                                        frisby.create('Activity Plan Edits: create a single activity plan with a single event to be used as master plan')
                                            .post(URL, activityPlan)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (activityPlanPostAnswer) {

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
                                                        expect(slavePlanPostAnswer.editStatus).toEqual('notEditableJoinedPlans');

                                                        // save joined plan id for later
                                                        var joinedPlanId = slavePlanPostAnswer.id;

                                                        // now try to modify something even though it is not allowed to update this joined plan
                                                        slavePlan = slavePlanPostAnswer;
                                                        slavePlan.mainEvent.frequency = "week";

                                                        frisby.create('Activity Plan Edits: try to update joined plan, id: ' + slavePlanPostAnswer.id)
                                                            .auth('test_ind2', 'yp')
                                                            .put(URL + '/' + slavePlanPostAnswer.id, slavePlan)
                                                            .expectStatus(405)
                                                            .afterJSON(function (activityPlanPutAnswer) {

                                                                // now try to modify something even though it is not allowed to update this master plan

                                                                frisby.create('Activity Plan Edits: reload masterPlan')
                                                                    .auth('test_ind1', 'yp')
                                                                    .get(URL + '/' + masterPlanId)
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (masterPlanReloaded) {
                                                                        expect(masterPlanReloaded.editStatus).toEqual('notEditableJoinedUsers');

                                                                        masterPlanReloaded.mainEvent.frequency = "week";

                                                                        frisby.create('Activity Plan Edits: try to update master plan, id: ' + masterPlanReloaded.id)
                                                                            .auth('test_ind1', 'yp')
                                                                            .put(URL + '/' + masterPlanReloaded.id, masterPlanReloaded)
                                                                            .expectStatus(405)
                                                                            .afterJSON(function (activityPlanPutAnswer) {

                                                                                // cleanup uneditable joined activity plan
                                                                                frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + joinedPlanId)
                                                                                    .delete(URL + '/' + joinedPlanId)
                                                                                    .auth('sysadm','backtothefuture')
                                                                                    .expectStatus(200)
                                                                                    .toss();

                                                                                // cleanup uneditable joined activity plan
                                                                                frisby.create('Activity Plan Edits: cleanup activity plan, id: ' + masterPlanReloaded.id)
                                                                                    .delete(URL + '/' + masterPlanReloaded.id)
                                                                                    .auth('sysadm','backtothefuture')
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

                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();

    })
    .toss();
