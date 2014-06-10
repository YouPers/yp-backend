var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activityplans';
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
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
        "frequency": "day",
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


frisby.create('test whether there is no conflict for the plan we are about to post')
    .post(URL + '/conflicts', masterPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(200)
    .afterJSON(function (emptyConflicts) {
        expect(emptyConflicts.length).toEqual(0);

        frisby.create('Activity Plan Slave: plan weekly activity for a conflict test')
            .post(URL, masterPlan)
            .auth('test_ind1', 'yp')
            .expectStatus(201)
            .afterJSON(function (newPlan) {
                expect(newPlan.events).toBeDefined();
                expect(newPlan.events.length).toEqual(masterPlan.mainEvent.recurrence['endby'].after);
                expect(newPlan.events[0].begin).toEqual(masterPlan.mainEvent.start);
                expect(newPlan.events[1].begin).toEqual('2014-06-17T12:00:00.000Z');
                expect(newPlan.id).toBeDefined();

                frisby.create('test whether there are now 6 conflicts')
                    .post(URL + '/conflicts', masterPlan)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (conflicts) {
                        expect(conflicts.length).toEqual(6);

                        masterPlan.mainEvent.start = "2014-06-16T11:55:00.000Z";
                        masterPlan.mainEvent.end = "2014-06-16T12:01:00.000Z";
                        masterPlan.mainEvent.frequency = 'once';

                        frisby.create('test for "once" plan with overlapping of first event, expect 1 conflict')
                            .post(URL + '/conflicts', masterPlan)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (conflicts) {

                                expect(conflicts.length).toEqual(1);

                                masterPlan.mainEvent.start = "2014-06-16T11:55:00.000Z";
                                masterPlan.mainEvent.end = "2014-06-16T12:00:00.000Z";
                                masterPlan.mainEvent.frequency = 'once';

                                frisby.create('test for "once" plan with end equals exact match of first event begin, expect 0 conflict')
                                    .post(URL + '/conflicts', masterPlan)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (conflicts) {

                                        expect(conflicts.length).toEqual(0);

                                        masterPlan.mainEvent.start = "2014-06-23T13:00:00.000Z";
                                        masterPlan.mainEvent.end = "2014-06-23T13:05:00.000Z";
                                        masterPlan.mainEvent.frequency = 'once';
                                        frisby.create('test for "once" plan with start equals exact match of last event end, expect 0 conflict')
                                            .post(URL + '/conflicts', masterPlan)
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (conflicts) {

                                                expect(conflicts.length).toEqual(0);

                                                masterPlan.mainEvent.start = "2014-06-23T12:59:00.000Z";
                                                masterPlan.mainEvent.end = "2014-06-23T13:05:00.000Z";
                                                masterPlan.mainEvent.frequency = 'once';
                                                frisby.create('test for "once" plan with start equals small overlap of last event end, expect 0 conflict')
                                                    .post(URL + '/conflicts', masterPlan)
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (conflicts) {
                                                        expect(conflicts.length).toEqual(1);

                                                        frisby.create('Activity Plan: delete the created activityPlan again')
                                                            .delete(URL + '/' + newPlan.id)
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
                    })
                    .toss();
            })
            .toss();

    })
    .
    toss();



