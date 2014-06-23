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


consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {

        var masterPlan = {
            "owner": user.id,
            "idea": consts.groupIdea.id,
            "visibility": "public",
            "executionType": "group",
            "title": "myTitle",
            "mainEvent": {
                "start": startDate,
                "end": endDate,
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


        frisby.create('ActivityPlanConflicts: test whether there is no conflict for the plan we are about to post')
            .post(URL + '/conflicts', masterPlan)
            .auth(user.username, 'yp')
            .expectStatus(200)
            .afterJSON(function (emptyConflicts) {
                expect(emptyConflicts.length).toEqual(0);

                frisby.create('ActivityPlanConflicts: plan weekly activity for a conflict test')
                    .post(URL, masterPlan)
                    .auth(user.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (newPlan) {
                        expect(newPlan.id).toBeDefined();

                        frisby.create('ActivityPlanConflicts: test whether there are now 6 conflicts')
                            .post(URL + '/conflicts', masterPlan)
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (conflicts) {
                                expect(conflicts.length).toEqual(6);

                                masterPlan.mainEvent.start = moment(startDate).subtract(5, 'm').toDate();
                                masterPlan.mainEvent.end = moment(startDate).add(1, 'm').toDate();
                                masterPlan.mainEvent.frequency = 'once';

                                frisby.create('ActivityPlanConflicts: test for "once" plan with overlapping of first event, expect 1 conflict')
                                    .post(URL + '/conflicts', masterPlan)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (conflicts) {

                                        expect(conflicts.length).toEqual(1);

                                        masterPlan.mainEvent.start = moment(startDate).subtract(5, 'm').toDate();
                                        masterPlan.mainEvent.end = startDate;
                                        masterPlan.mainEvent.frequency = 'once';

                                        frisby.create('ActivityPlanConflicts: test for "once" plan with end equals exact match of first event begin, expect 0 conflict')
                                            .post(URL + '/conflicts', masterPlan)
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (conflicts) {

                                                expect(conflicts.length).toEqual(0);

                                                masterPlan.mainEvent.start = endDate;
                                                masterPlan.mainEvent.end = moment(endDate).add(5, 'm').toDate();
                                                masterPlan.mainEvent.frequency = 'once';
                                                frisby.create('ActivityPlanConflicts: test for "once" plan with start equals exact match of last event end, expect 0 conflict')
                                                    .post(URL + '/conflicts', masterPlan)
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (conflicts) {

                                                        expect(conflicts.length).toEqual(0);

                                                        masterPlan.mainEvent.start = moment(endDate).subtract(1, 'm').toDate();
                                                        masterPlan.mainEvent.end = moment(endDate).add(5, 'm').toDate();
                                                        masterPlan.mainEvent.frequency = 'once';
                                                        frisby.create('ActivityPlanConflicts: test for "once" plan with start equals small overlap of last event end, expect 1 conflict')
                                                            .post(URL + '/conflicts', masterPlan)
                                                            .auth(user.username, 'yp')
                                                            .expectStatus(200)
                                                            .afterJSON(function (conflicts) {
                                                                expect(conflicts.length).toEqual(1);

                                                                frisby.create('ActivityPlanConflicts: delete the created activityPlan again')
                                                                    .delete(URL + '/' + newPlan.id)
                                                                    .auth(user.username, 'yp')
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

    }
);
