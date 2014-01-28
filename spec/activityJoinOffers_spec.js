var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});

var joinable = {
    "owner": consts.users.unittest.id,
    "activity": consts.groupActivity.id,
    "visibility": "public",
    "executionType": "group",
    "mainEvent": {
        "start": "2014-10-16T12:00:00.000Z",
        "end": "2014-10-16T13:00:00.000Z",
        "allDay": false,
        "frequency": "once"
    }
}


frisby.create('Activity Join Offers: plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": consts.users.unittest.id,
        "activity": consts.groupActivity.id,
        "visibility": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (joinablePlan) {

        var joinablePlanID = joinablePlan.id;
        var slavePlanID;

        frisby.create(' get all joinoffers for this activity and see whether this plan is in the list')
            .get(URL + '/activityplans/joinOffers?activity=5278c6adcdeab69a2500001e')
            .expectStatus(200)
            .expectJSON('?', {
                id: joinablePlan.id,
                activity: consts.groupActivity.id
            })
            .afterJSON(function (joinablePlans) {
                _.forEach(joinablePlans, function (joinablePlan) {
                    expect(joinablePlan.masterPlan).not.toBeDefined();
                });

                joinable.masterPlan = joinablePlan.id;
                joinable.owner = consts.users.reto.id;

                frisby.create('send an invitation to reto to join the plan')
                    .post(URL + '/activityplans/'+ joinablePlan.id + "/inviteEmail", {email: 'ypunittest1@gmail.com'})
                    .expectStatus(200)
                    .toss();


                frisby.create('join the first joinablePlan as a different user')
                    .auth('reto', 'reto')
                    .post(URL + '/activityplans', joinable)
                    .expectStatus(201)
                    .expectJSON({
                        activity: consts.groupActivity.id,
                        masterPlan: joinablePlan.id
                    })
                    .afterJSON(function(slavePlan) {

                        slavePlanID = slavePlan.id;

                        expect(slavePlan.joiningUsers[0].id).toEqual(consts.users.unittest.id);
                        frisby.create('get all the joinOffers again, and check whether the slave plan is not included in the list')
                            .get(URL + '/activityplans/joinOffers?activity=' + consts.groupActivity.id)
                            .expectStatus(200)
                            .expectJSON('?', {
                                id: joinablePlan.id,
                                activity: consts.groupActivity.id
                            })
                            .afterJSON(function (newJoinableList) {
                                _.forEach(newJoinableList, function(plan) {
                                    expect(plan.masterPlan).not.toBeDefined();
                                    expect(plan.id).not.toEqual(slavePlan.id);
                                    if (plan.id === joinablePlan.id) {
                                        expect(plan.joiningUsers).toContain(consts.users.reto.id);
                                    }
                                })

                                frisby.create('Activity Plan Slave: delete slave')
                                    .delete(URL + '/activityplans/' + slavePlanID)
                                    .auth('sysadm','backtothefuture')
                                    .expectStatus(200)
                                    .toss();

                                frisby.create('Activity Plan Slave: delete master')
                                    .delete(URL + '/activityplans/' + joinablePlanID)
                                    .auth('sysadm','backtothefuture')
                                    .expectStatus(200)
                                    .toss();
                                ;

                            }).toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();