var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/activities';
var consts = require('./testconsts');
var moment = require('moment');
var _ = require('lodash');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

// set the startDate in the future and ensure that it is a Wednesday
var startDate = moment().add(12, 'd').day(4).toDate();
var endDate = moment(startDate).add(1, 'h').toDate();


consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {

        var masterPlan = {
            "owner": user.id,
            "idea": consts.groupIdea.id,
            "visibility": "public",
            "executionType": "group",
            "title": "myTitle",
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
            },
            "status": "active"
        };


        frisby.create('ActivityConflicts: test whether there is no conflict for the activity we are about to post')
            .post(URL + '/validate', masterPlan)
            .auth(user.username, 'yp')
            .expectStatus(200)
            .afterJSON(function (results) {
                expect(results.length).toEqual(6);
                expect(_.filter(results, 'conflictingEvent').length).toEqual(0);

                frisby.create('ActivityConflicts: plan weekly activity for a conflict test')
                    .post(URL, masterPlan)
                    .auth(user.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (newPlan) {
                        expect(newPlan.id).toBeDefined();

                        frisby.create('ActivityConflicts: test whether there are now 6 conflicts')
                            .post(URL + '/validate', masterPlan)
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (results) {
                                expect(_.filter(results, 'conflictingEvent').length).toEqual(6);

                                masterPlan.start = moment(startDate).subtract(5, 'm').toDate();
                                masterPlan.end = moment(startDate).add(1, 'm').toDate();
                                masterPlan.frequency = 'once';

                                frisby.create('ActivityConflicts: test for "once" activity with overlapping of first event, expect 1 conflict')
                                    .post(URL + '/validate', masterPlan)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (results) {

                                        expect(_.filter(results, 'conflictingEvent').length).toEqual(1);

                                        masterPlan.start = moment(startDate).subtract(5, 'm').toDate();
                                        masterPlan.end = startDate;
                                        masterPlan.frequency = 'once';

                                        frisby.create('ActivityConflicts: test for "once" activity with end equals exact match of first event begin, expect 0 conflict')
                                            .post(URL + '/validate', masterPlan)
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (results) {

                                                expect(_.filter(results, 'conflictingEvent').length).toEqual(0);

                                                masterPlan.start = endDate;
                                                masterPlan.end = moment(endDate).add(5, 'm').toDate();
                                                masterPlan.frequency = 'once';
                                                frisby.create('ActivityConflicts: test for "once" activity with start equals exact match of last event end, expect 0 conflict')
                                                    .post(URL + '/validate', masterPlan)
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (results) {

                                                        expect(_.filter(results, 'conflictingEvent').length).toEqual(0);

                                                        masterPlan.start = moment(endDate).subtract(1, 'm').toDate();
                                                        masterPlan.end = moment(endDate).add(5, 'm').toDate();
                                                        masterPlan.frequency = 'once';
                                                        frisby.create('ActivityConflicts: test for "once" activity with start equals small overlap of last event end, expect 1 conflict')
                                                            .post(URL + '/validate', masterPlan)
                                                            .auth(user.username, 'yp')
                                                            .expectStatus(200)
                                                            .afterJSON(function (results) {

                                                                expect(_.filter(results, 'conflictingEvent').length).toEqual(1);

                                                                frisby.create('ActivityConflicts: delete the created activity again')
                                                                    .delete(URL + '/' + newPlan.id)
                                                                    .auth(user.username, 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function () {
                                                                        return cleanupFn();
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
            .
            toss();

    }
);
