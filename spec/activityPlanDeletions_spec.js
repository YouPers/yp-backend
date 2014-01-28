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
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});

var masterPlan = {
    "owner": consts.users.unittest.id,
    "activity": consts.groupActivity.id,
    "visibility": "public",
    "executionType": "group",
    "mainEvent": {
        "start": "2014-06-16T12:00:00.000Z",
        "end": "2014-06-16T13:00:00.000Z",
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
};

frisby.create('Activity Plan Deletions: create a master plan for an activity plan deletion test')
    .post(URL, masterPlan)
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {

        var masterPlanId = masterPlanPostAnswer.id;

        expect(masterPlanPostAnswer.deleteStatus).toEqual('ACTIVITYPLAN_DELETABLE');

        // create a slave Plan for this masterPlan
        var slavePlan = masterPlanPostAnswer;
        slavePlan.masterPlan = masterPlanPostAnswer.id;
        delete slavePlan.id;
        delete slavePlan.events;
        delete slavePlan.joiningUsers;
        slavePlan.owner = consts.users.reto.id;

        frisby.create('Activity Plan Deletions: post a joining plan ')
            .auth(consts.users.reto.username, consts.users.reto.password)
            .post(URL + '?populate=joiningUsers', slavePlan)
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.deleteStatus).toEqual('ACTIVITYPLAN_NOT_DELETABLE_JOINED_PLAN');

                frisby.create('Activity Plan Deletions: reload masterPlan')
                    .get(URL + '/' + masterPlanId)
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.deleteStatus).toEqual('ACTIVITYPLAN_NOT_DELETABLE_JOINED_USERS');

                        // try to delete "undeletable" slave plan
                        frisby.create('Activity Plan Deletions: try delete slave')
                            .delete(URL + '/' + slavePlanPostAnswer.id)
                            .expectStatus(409)
                            .toss();

                        // try to delete "undeletable" master plan
                        frisby.create('Activity Plan Deletions: try delete master')
                            .delete(URL + '/' + masterPlanReloaded.id)
                            .expectStatus(409)
                            .toss();

                        // clean up database by removing the slave plan
                        frisby.create('Activity Plan Deletions: remove slave')
                            .delete(URL + '/' + slavePlanPostAnswer.id)
                            .auth('sysadm','backtothefuture')
                            .expectStatus(200)
                            .toss();

                        // clean up database by removing the master plan
                        frisby.create('Activity Plan Deletions: remove master')
                            .delete(URL + '/' + masterPlanReloaded.id)
                            .auth('sysadm','backtothefuture')
                            .expectStatus(200)
                            .toss();

                        var pastDateStart = new Date();
                        pastDateStart.setDate(pastDateStart.getDate()-1);
                        var pastDateEnd = new Date();
                        pastDateEnd.setDate(pastDateEnd.getDate()-1);
                        pastDateEnd.setHours(pastDateEnd.getHours()+1);
                        masterPlan.mainEvent.start = pastDateStart;
                        masterPlan.mainEvent.end = pastDateEnd;
                        masterPlan.mainEvent.frequency = "week";

                        frisby.create('Activity Plan Deletions: create activity plan with one event in the past')
                            .post(URL, masterPlan)
                            .expectStatus(201)
                            .afterJSON(function (masterPlanPostAnswer){

                                expect(masterPlanPostAnswer.deleteStatus).toEqual('ACTIVITYPLAN_DELETABLE_ONLY_FUTURE_EVENTS');

                                // delete by removing future events
                                frisby.create('Activity Plan Deletions: delete future events')
                                    .delete(URL + '/' + masterPlanPostAnswer.id)
                                    .expectStatus(200)
                                    .toss();

                                frisby.create('Activity Plan Deletions: reload masterPlan')
                                    .get(URL + '/' + masterPlanPostAnswer.id)
                                    .expectStatus(200)
                                    .afterJSON(function (masterPlanReloaded) {
                                        expect(masterPlanReloaded.events.length).toEqual(1);

                                        // clean up database by removing the plan
                                        frisby.create('Activity Plan Deletions: remove plan')
                                            .delete(URL + '/' + masterPlanPostAnswer.id)
                                            .auth('sysadm','backtothefuture')
                                            .expectStatus(200)
                                            .toss()

                                        pastDateStart = new Date();
                                        pastDateStart.setDate(pastDateStart.getDate()-30);
                                        pastDateEnd = new Date();
                                        pastDateEnd.setDate(pastDateEnd.getDate()-30);
                                        pastDateEnd.setHours(pastDateEnd.getHours()+1);
                                        masterPlan.mainEvent.start = pastDateStart;
                                        masterPlan.mainEvent.end = pastDateEnd;
                                        masterPlan.mainEvent.frequency = "day";

                                        frisby.create('Activity Plan Deletions: create activity plan with all events in the past')
                                            .post(URL, masterPlan)
                                            .expectStatus(201)
                                            .afterJSON(function (masterPlanPostAnswer){

                                                expect(masterPlanPostAnswer.deleteStatus).toEqual('ACTIVITYPLAN_NOT_DELETABLE_NO_FUTURE_EVENTS');

                                                // try deleting undeletable activity plan
                                                frisby.create('Activity Plan Deletions: delete future events')
                                                    .delete(URL + '/' + masterPlanPostAnswer.id)
                                                    .expectStatus(409)
                                                    .toss();

                                                // clean up database by removing the plan
                                                frisby.create('Activity Plan Deletions: remove plan')
                                                    .delete(URL + '/' + masterPlanPostAnswer.id)
                                                    .auth('sysadm','backtothefuture')
                                                    .expectStatus(200)
                                                    .toss()

                                            }).toss();

                                    }).toss();


                            }).toss();

                    }).toss();

            })
            .toss();
    })

    .toss();
