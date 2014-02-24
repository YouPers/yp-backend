var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});


var joinable = {
    "owner": consts.users.test_ind1.id,
    "activity": consts.groupActivity.id,
    "visibility": "public",
    "executionType": "group",
    "title": "myTitle",
    "mainEvent": {
        "start": "2014-10-16T12:00:00.000Z",
        "end": "2014-10-16T13:00:00.000Z",
        "allDay": false,
        "frequency": "once"
    }
};


frisby.create('Activity Join Offers: plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind1.id,
        "activity": consts.groupActivity.id,
        "visibility": "public",
        "title": "myTitle2",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (joinablePlan) {

        var joinablePlanID = joinablePlan.id;
        var slavePlanID;

        frisby.create('ActivityJoinOffers: get all joinoffers for this activity as user from different campaign and see whether this plan is in the list')
            .get(URL + '/activityplans/joinOffers?activity=5278c6adcdeab69a2500001e')
            .auth('test_ind3', 'yp')
            .expectStatus(200)
            .afterJSON(function(joinOffers) {
                expect(_.any(joinOffers, {id: joinablePlan.id})).toBeFalsy();
            })
            .toss();

        frisby.create('ActivityJoinOffers: get all joinoffers for this activity and see whether this plan is in the list')
            .get(URL + '/activityplans/joinOffers?activity=5278c6adcdeab69a2500001e')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .expectJSON('?', {
                id: joinablePlan.id,
                activity: consts.groupActivity.id
            })
            .afterJSON(function (joinablePlans) {
                _.forEach(joinablePlans, function (joinablePlan) {
                    expect(joinablePlan.masterPlan).not.toBeDefined();
                });
                expect(_.any(joinablePlans, {id: joinablePlan.id})).toBeTruthy();

                joinable.masterPlan = joinablePlan.id;
                joinable.owner = consts.users.test_ind2.id;

                frisby.create('ActivityJoinOffers: send an invitation to test user "individual2" to join the plan')
                    .post(URL + '/activityplans/'+ joinablePlan.id + "/inviteEmail", {email: 'ypunittest1+individual2@gmail.com'})
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

                frisby.create('ActivityJoinOffers: send an invitation to test user "individual2" to join the plan, in English')
                    .post(URL + '/activityplans/'+ joinablePlan.id + "/inviteEmail", {email: 'ypunittest1+individual2@gmail.com'})
                    .addHeader('yp-language', 'en')
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();


                frisby.create('ActivityJoinOffers: join the first joinablePlan as a different user')
                    .auth('test_ind2', 'yp')
                    .post(URL + '/activityplans', joinable)
                    .expectStatus(201)
                    .expectJSON({
                        activity: consts.groupActivity.id,
                        masterPlan: joinablePlan.id
                    })
                    .afterJSON(function(slavePlan) {

                        slavePlanID = slavePlan.id;

                        expect(slavePlan.joiningUsers[0].id).toEqual(consts.users.test_ind1.id);
                        frisby.create('ActivityJoinOffers: get all the joinOffers again, and check whether the slave plan is not included in the list')
                            .get(URL + '/activityplans/joinOffers?activity=' + consts.groupActivity.id)
                            .auth('test_ind1', 'yp')
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
                                        expect(plan.joiningUsers).toContain(consts.users.test_ind2.id);
                                    }
                                });

                                frisby.create('ActivityJoinOffers: Activity Plan Slave: delete slave')
                                    .delete(URL + '/activityplans/' + slavePlanID)
                                    .auth('test_sysadm','yp')
                                    .expectStatus(200)
                                    .toss();

                                frisby.create('ActivityJoinOffers: Activity Plan Slave: delete master')
                                    .delete(URL + '/activityplans/' + joinablePlanID)
                                    .auth('test_sysadm','yp')
                                    .expectStatus(200)
                                    .toss();

                            }).toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();