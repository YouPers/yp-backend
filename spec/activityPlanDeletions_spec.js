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
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

// set the startDate in the future and ensure that it is a Wednesday
var startDate = moment().add('d',5).day(4).toDate();
var endDate = moment(startDate).add('h',1).toDate();

var masterPlan = {
    "owner": consts.users.test_ind1.id,
    "activity": consts.groupActivity.id,
    "visibility": "public",
    "executionType": "group",
    "title": "myTitle",
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
};

frisby.create('Activity Plan Deletions: create a master plan for an activity plan deletion test')
    .post(URL, masterPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {

        var masterPlanId = masterPlanPostAnswer.id;

        expect(masterPlanPostAnswer.deleteStatus).toEqual('deletable');

        // create a slave Plan for this masterPlan
        var slavePlan = masterPlanPostAnswer;
        slavePlan.masterPlan = masterPlanPostAnswer.id;
        delete slavePlan.id;
        delete slavePlan.events;
        delete slavePlan.joiningUsers;
        slavePlan.owner = consts.users.test_ind2.id;

        frisby.create('Activity Plan Deletions: post a joining plan ')
            .post(URL + '?populate=joiningUsers', slavePlan)
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.deleteStatus).toEqual('deletable');

                frisby.create('Activity Plan Deletions: reload masterPlan')
                    .get(URL + '/' + masterPlanId)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.deleteStatus).toEqual('deletable');
                        expect(masterPlanReloaded.joiningUsers).toContain(consts.users.test_ind2.id);

                        frisby.create('Activity Plan Deletions: try delete slave, SUCCESS')
                            .delete(URL + '/' + slavePlanPostAnswer.id)
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .after(function () {

                                frisby.create('Activity Plan Deletions: reload masterPlan, check empty JoiningUsers')
                                    .get(URL + '/' + masterPlanId)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (masterPlanReloaded2) {
                                        expect(masterPlanReloaded2.deleteStatus).toEqual('deletable');
                                        expect(masterPlanReloaded2.joiningUsers).not.toContain(consts.users.test_ind2.id);

                                        frisby.create('Activity Plan Deletions: post a joining plan again')
                                            .post(URL + '?populate=joiningUsers', slavePlan)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (slavePlanPostAnswer2) {
                                                expect(slavePlanPostAnswer2.deleteStatus).toEqual('deletable');
                                                expect(slavePlanPostAnswer2.masterPlan).toEqual(masterPlanId);

                                                frisby.create('Activity Plan Deletions: try delete master with an existing joining, SUCCESS')
                                                    .delete(URL + '/' + masterPlanReloaded.id+'?reason=I am sick')
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .after(function () {

                                                        frisby.create('Activity Plan Deletions: check whether master gone')
                                                            .get(URL + '/' + masterPlanReloaded.id)
                                                            .auth('test_ind1', 'yp')
                                                            .expectStatus(404)
                                                            .toss();

                                                        frisby.create('Activity Plan Deletions: check whether slave gone')
                                                            .get(URL + '/' + slavePlanPostAnswer2.id)
                                                            .auth('sysadm', 'backtothefuture')
                                                            .expectStatus(404)
                                                            .toss();

                                                    })
                                                    .toss();
                                            })
                                            .toss();
                                    })
                                    .toss();
                            })
                            .toss();

                    }).toss();

            })
            .toss();

    })

    .toss();

        var pastDateStart = new Date();
        pastDateStart.setDate(pastDateStart.getDate() - 1);
        var pastDateEnd = new Date();
        pastDateEnd.setDate(pastDateEnd.getDate() - 1);
        pastDateEnd.setHours(pastDateEnd.getHours() + 1);
        masterPlan.mainEvent.start = pastDateStart;
        masterPlan.mainEvent.end = pastDateEnd;
        masterPlan.mainEvent.frequency = "week";

        frisby.create('Activity Plan Deletions: create activity plan with one event in the past')
            .post(URL, masterPlan)
            .auth('test_ind1', 'yp')
            .expectStatus(201)
            .afterJSON(function (masterPlanPostAnswer) {

                expect(masterPlanPostAnswer.deleteStatus).toEqual('deletableOnlyFutureEvents');

                // delete by removing future events
                frisby.create('Activity Plan Deletions: delete future events')
                    .delete(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

                frisby.create('Activity Plan Deletions: reload masterPlan')
                    .get(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.events.length).toEqual(1);

                        // clean up database by removing the plan
                        frisby.create('Activity Plan Deletions: remove plan')
                            .delete(URL + '/' + masterPlanPostAnswer.id)
                            .auth('sysadm', 'backtothefuture')
                            .expectStatus(200)
                            .toss();

                        pastDateStart = new Date();
                        pastDateStart.setDate(pastDateStart.getDate() - 30);
                        pastDateEnd = new Date();
                        pastDateEnd.setDate(pastDateEnd.getDate() - 30);
                        pastDateEnd.setHours(pastDateEnd.getHours() + 1);
                        masterPlan.mainEvent.start = pastDateStart;
                        masterPlan.mainEvent.end = pastDateEnd;
                        masterPlan.mainEvent.frequency = "day";

                        frisby.create('Activity Plan Deletions: create activity plan with all events in the past')
                            .post(URL, masterPlan)
                            .auth('test_ind1', 'yp')
                            .expectStatus(201)
                            .afterJSON(function (masterPlanPostAnswer) {

                                expect(masterPlanPostAnswer.deleteStatus).toEqual('notDeletableNoFutureEvents');

                                // try deleting undeletable activity plan
                                frisby.create('Activity Plan Deletions: try delete future Plan with No Future Events ')
                                    .delete(URL + '/' + masterPlanPostAnswer.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .toss();

                            }).toss();

                    }).toss();


            }).toss();




