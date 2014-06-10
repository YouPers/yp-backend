/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 29.11.13
 * Time: 09:18
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activityplans';
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var masterPlan = {
    "owner": consts.users.test_ind1.id,
    "activity": consts.groupActivity.id,
    "visibility": "public",
    "executionType": "group",
    "title": "myTitle",
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

frisby.create('Activity Plan Slave: plan weekly activity as a master for a joining test')
    .post(URL, masterPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {
        expect(masterPlanPostAnswer.events).toBeDefined();
        expect(masterPlanPostAnswer.events.length).toEqual(masterPlan.mainEvent.recurrence['endby'].after);
        expect(masterPlanPostAnswer.events[0].begin).toEqual(masterPlan.mainEvent.start);
        expect(masterPlanPostAnswer.events[1].begin).toEqual('2014-06-23T12:00:00.000Z');
        expect(masterPlanPostAnswer.id).toBeDefined();

        // create a slave Plan for this masterPlan
        var slavePlan = masterPlanPostAnswer;
        slavePlan.masterPlan = masterPlanPostAnswer.id;
        delete slavePlan.id;
        delete slavePlan.events;
        delete slavePlan.joiningUsers;
        slavePlan.owner = consts.users.test_ind2.id;

        frisby.create('Activity Plan Slave: post a joining plan ')
            .post(URL + '?populate=joiningUsers', slavePlan)
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.masterPlan).toEqual(slavePlan.masterPlan);
                expect(slavePlanPostAnswer.joiningUsers.length).toBeGreaterThan(0);
                expect(slavePlanPostAnswer.joiningUsers[0].id).toEqual(masterPlan.owner);
                expect(slavePlanPostAnswer.joiningUsers.length).toEqual(1); // user selbst ist nicht im Array


                // update an event on the master with a new comment and check whether it is visible on the slave
                //frisby.create('update an event on the master with a new comment and check whether it is visible on the slave')
                //    .put(URL + )

                frisby.create('Activity Plan Slave: reload masterPlan')
                    .get(URL + '/' + slavePlan.masterPlan)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.masterPlan).not.toBeDefined();
                        expect(masterPlanReloaded.joiningUsers).toContain(slavePlanPostAnswer.owner.id);
                        expect(masterPlanReloaded.joiningUsers).not.toContain(masterPlanReloaded.owner.id);
                    }).toss();

                frisby.create('Activity Plan Slave: reload slavePlan')
                    .get(URL + '/' + slavePlanPostAnswer.id)
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (slavePlanReloaded) {
                        expect(slavePlanReloaded.masterPlan).toEqual(slavePlan.masterPlan);
                        expect(slavePlanReloaded.joiningUsers.length).toBeGreaterThan(0);
                        expect(slavePlanReloaded.joiningUsers[0].id).toEqual(masterPlan.owner);
                        expect(slavePlanReloaded.joiningUsers).not.toContain(slavePlanPostAnswer.owner);

                        frisby.create('Activity Plan Slave: update Event on Slave, add comment')
                            .put(URL + '/' + slavePlanReloaded.id + '/events/' + slavePlanReloaded.events[0].id,
                            {"feedback": "2", "comment": "new Text from UnitTest"}, {json: true})
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                expect(newUpdatedEvent.comment).toBeDefined();
                                expect(newUpdatedEvent.feedback).toEqual(2);


                                frisby.create('Activity Plan Slave: reload slavePlan and check whether we have the comment')
                                    .get(URL + '/' + slavePlanPostAnswer.id)
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (slavePlanReloadedAgain) {
                                        expect(slavePlanReloadedAgain.events[0].comment).toBeDefined();
                                        expect(slavePlanReloadedAgain.events[0].comment).toEqual("new Text from UnitTest");

                                        frisby.create('Activity Plan Slave: delete slave')
                                            .delete(URL + '/' + slavePlanReloaded.id)
                                            .auth('sysadm','backtothefuture')
                                            .expectStatus(200)
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
