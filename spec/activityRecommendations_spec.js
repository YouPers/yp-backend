var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

// TODO: talk about open questions first: https://youpers.atlassian.net/browse/WL-936

// disabled for now
return;

frisby.create('ActivityRecommendations: post a first answer for this assessment')
    .post(URL + '/assessments/525faf0ac558d40000000005/results',
    {owner: consts.users.test_ind2.id,
        assessment: '525faf0ac558d40000000005',
        answers: [
            {assessment: '525faf0ac558d40000000005',
                question: '5278c51a6166f2de240000cc',
                answer: -23,
                answered: true},
            {assessment: '525faf0ac558d40000000005',
                question: '5278c51a6166f2de240000cb',
                answer: 23,
                answered: true}
        ]
    })
    .auth('test_ind2', 'yp')
    .expectStatus(201)
    .afterJSON(function (json) {
        frisby.create('ActivityRecommendations: get recommendations')
            .get(URL + '/recommendations')
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function(recs) {
                expect(recs.length).toEqual(10);
                frisby.create('ActivityRecommendations: reject first recommendation')
                    .put(URL + '/profiles/'+ consts.users.test_ind2.profile,
                        {

                            prefs: {
                                "calendarNotification": "900",
                                "defaultWorkWeek": ["MO", "TU", "WE", "TH", "FR"],
                                "email": {
                                    "actPlanInvites": true,
                                    "dailyUserMail": false,
                                    "iCalInvites": false
                                },
                                rejectedIdeas:
                                    [{idea: recs[0].idea, timestamp: new Date().toISOString()}],

                                "rejectedActivities": [],
                                "starredIdeas": []
                            }
                        })
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .afterJSON(function(updatedProfile) {
                        frisby.create('ActivityRecommendations: get recommendations again and check whether old number 2 is now number 1')
                            .get(URL + '/recommendations')
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .afterJSON(function(newRecs) {
                                expect(newRecs.length).toEqual(10);
                                expect(newRecs[0].idea).not.toEqual(recs[0].idea);
                                expect(newRecs[0].idea).toEqual(recs[1].idea);

                                frisby.create('ActivityRecommendations: reset rejectedIdeas on the profile')
                                    .put(URL + '/profiles/' + consts.users.test_ind2.profile,
                                    {
                                        prefs: {
                                            "calendarNotification": "900",
                                            "defaultWorkWeek": ["MO", "TU", "WE", "TH", "FR"],
                                            "email": {
                                                "actPlanInvites": true,
                                                "dailyUserMail": false,
                                                "iCalInvites": false
                                            },
                                            "rejectedIdeas": [],
                                            "rejectedActivities": [],
                                            "starredIdeas": []
                                        }
                                    })
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function(newprofile) {
                                        expect(newprofile.prefs.rejectedIdeas.length).toEqual(0);
                                    })
                                    .toss();

                                frisby.create('ActivityRecommendations: remove AssessmentResults')
                                    .delete(URL + '/assessments/525faf0ac558d40000000005/results')
                                    .auth('test_ind2', 'yp')
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