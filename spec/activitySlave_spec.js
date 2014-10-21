/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 29.11.13
 * Time: 09:18
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activities';
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var masterPlan = {
    "owner": consts.users.test_ind1.id,
    "idea": consts.groupIdea.id,
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

frisby.create('Event Slave: plan weekly event as a master for a joining test')
    .post(URL, masterPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {
        expect(masterPlanPostAnswer.id).toBeDefined();

        frisby.create('Event Slave: join the event')
            .post(URL + '/' + masterPlanPostAnswer.id +'/join')
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(masterPlanPostAnswer.id).toEqual(slavePlanPostAnswer.id);
                expect(slavePlanPostAnswer.joiningUsers.length).toBeGreaterThan(0);
                expect(slavePlanPostAnswer.joiningUsers[0]).toEqual(consts.users.test_ind2.id);
                expect(slavePlanPostAnswer.joiningUsers.length).toEqual(1); // owner is nicht im Array


                frisby.create('Event Slave: reload masterPlan')
                    .get(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.joiningUsers).toContain(consts.users.test_ind2.id);
                        expect(masterPlanReloaded.joiningUsers).not.toContain(masterPlanReloaded.owner.id);

                        frisby.create('Event Slave: delete event')
                            .delete(URL + '/' + masterPlanPostAnswer.id)
                            .auth('sysadm','backtothefuture')
                            .expectStatus(200)
                            .toss();

                    }).toss();



            })
            .toss();
    })
    .toss();
