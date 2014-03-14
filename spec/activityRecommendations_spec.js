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


frisby.create('ActivityRecommendations: post a first answer for this assessment')
    .post(URL + '/assessments/525faf0ac558d40000000005/results',
    {owner: consts.users.test_ind2.id,
        assessment: '525faf0ac558d40000000005',
        timestamp: new Date(),
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
            .get(URL + '/activities/recommendations')
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function(recs) {
                expect(recs.length).toEqual(10);
                console.log(JSON.stringify(recs));

                frisby.create('ActivityRecommendations: reject first recommendation')
                    .put(URL + '/profiles/'+ consts.users.test_ind2.profile,
                        {userPreferences:
                            {rejectedActivities:
                                [{activity: recs[0].activity, timestamp: new Date().toISOString()}]
                            }
                        })
                    .auth('test_ind2', 'yp')
                    .expectStatus(200)
                    .afterJSON(function(updatedProfile) {
                        console.log(JSON.stringify(updatedProfile));
                        frisby.create('ActivityRecommendations: get recommendations again and check whether old number 2 is now number 1')
                            .get(URL + '/activities/recommendations')
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .afterJSON(function(newRecs) {
                                expect(newRecs.length).toEqual(10);
                                expect(newRecs[0].activity).not.toEqual(recs[0].activity);
                                expect(newRecs[0].activity).toEqual(recs[1].activity);
                                console.log(JSON.stringify(newRecs));

                                frisby.create('ActivityRecommendations: reset rejectedActivities on the profile')
                                    .put(URL + '/profiles/' + consts.users.test_ind2.profile,
                                    {userPreferences:
                                    {rejectedActivities:
                                        []
                                    }
                                    })
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function(newprofile) {
                                        expect(newprofile.userPreferences.rejectedActivities.length).toEqual(0);
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