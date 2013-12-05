/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 29.11.13
 * Time: 09:18
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activitiesPlanned';
var _ = require('lodash');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});

var masterPlan = {
    "owner": "525fb247101e330000001008",
    "activity": "5278c6adcdeab69a2500001e",
    "visibility": "public",
    "executionType": "group",
    "mainEvent": {
        "start": "2014-10-16T12:00:00.000Z",
        "end": "2014-10-16T13:00:00.000Z",
        "allDay": false,
        "frequency": "week",
        "recurrence": {
            "end-by": {
                "type": "after",
                "after": 6
            },
            "every": 1,
            "exceptions": []
        }
    },
    "status": "active"
};

frisby.create('plan weekly activity as a master for a joining test')
    .post(URL, masterPlan)
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {
        expect(masterPlanPostAnswer.events).toBeDefined();
        expect(masterPlanPostAnswer.events.length).toEqual(masterPlan.mainEvent.recurrence['end-by'].after);
        expect(masterPlanPostAnswer.events[0].begin).toEqual(masterPlan.mainEvent.start);
        expect(masterPlanPostAnswer.events[1].begin).toEqual('2014-10-23T12:00:00.000Z');
        expect(masterPlanPostAnswer.id).toBeDefined();

        // create a slave Plan for this masterPlan
        var slavePlan = masterPlanPostAnswer;
        slavePlan.masterPlan = masterPlanPostAnswer.id;
        delete slavePlan.id;
        delete slavePlan.events;
        delete slavePlan.joiningUsers;
        slavePlan.owner = '525fb247101e330000000005';
        frisby.create('post a joining plan ')
            .auth('reto', 'reto')
            .post(URL, slavePlan)
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.masterPlan).toEqual(slavePlan.masterPlan);
                expect(slavePlanPostAnswer.joiningUsers).toContain(masterPlan.owner);
                expect(slavePlanPostAnswer.joiningUsers).not.toContain(slavePlanPostAnswer.owner);


                // update an event on the master with a new comment and check whether it is visible on the slave
                //frisby.create('update an event on the master with a new comment and check whether it is visible on the slave')
                //    .put(URL + )

                frisby.create('reload masterPlan')
                    .get(URL + '/' + slavePlan.masterPlan)
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.masterPlan).not.toBeDefined();
                        expect(masterPlanReloaded.joiningUsers).toContain(slavePlanPostAnswer.owner);
                        expect(masterPlanReloaded.joiningUsers).not.toContain(masterPlanReloaded.owner);
                    }).toss();

                frisby.create('reload slavePlan')
                    .get(URL + '/' + slavePlanPostAnswer.id)
                    .auth('reto', 'reto')
                    .expectStatus(200)
                    .afterJSON(function (slavePlanReloaded) {
                        expect(slavePlanReloaded.masterPlan).toEqual(slavePlan.masterPlan);
                        expect(slavePlanReloaded.joiningUsers).toContain(masterPlan.owner);
                        expect(slavePlanReloaded.joiningUsers).not.toContain(slavePlanPostAnswer.owner);

                        frisby.create('update Event on Slave, add comment')
                            .auth('reto','reto')
                            .put(URL + '/' + slavePlanReloaded.id + '/events/' + slavePlanReloaded.events[0].id,
                            {"feedback": "2", "comments": [
                                {"text": "new Text from UnitTest"}
                            ]}, {json: true})
                            .expectStatus(200)
                            .afterJSON(function (newUpdatedEvent) {
                                console.log(newUpdatedEvent);
                                expect(newUpdatedEvent.comments.length).toEqual(1);
                                expect(newUpdatedEvent.feedback).toEqual(2);


                                frisby.create('reload slavePlan and check whether we have the comment')
                                    .get(URL + '/' + slavePlanPostAnswer.id + '?populate=events.comments')
                                    .auth('reto', 'reto')
                                    .expectStatus(200)
                                    .afterJSON(function (slavePlanReloadedAgain) {
                                        expect(slavePlanReloadedAgain.events[0].comments).toBeDefined();
                                        expect(slavePlanReloadedAgain.events[0].comments.length).toEqual(1);
                                        expect(slavePlanReloadedAgain.events[0].comments[0].text).toEqual("new Text from UnitTest");

                                        frisby.create('delete slave')
                                            .delete(URL + '/' + slavePlanReloaded.id)
                                            .expectStatus(200)
                                            .toss();
                                    })
                                    .toss();

                                frisby.create('reload masterPlan and check whether we see the comment that was made on a slave')
                                    .get(URL + '/' + slavePlanReloaded.masterPlan + '?populate=events.comments')
                                    .expectStatus(200)
                                    .afterJSON(function (masterPlanReloadedAgain) {
                                        expect(masterPlanReloadedAgain.events[0].comments).toBeDefined();
                                        expect(masterPlanReloadedAgain.events[0].comments.length).toEqual(1);
                                        expect(masterPlanReloadedAgain.events[0].comments[0].text).toEqual("new Text from UnitTest");

                                        frisby.create('delete master')
                                            .delete(URL + '/' + slavePlan.masterPlan)
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
