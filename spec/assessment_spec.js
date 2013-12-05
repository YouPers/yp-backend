var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port +'/assessments';



frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA=='
        }

    }
});



frisby.create('GET all assessments')
    .get(URL)
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        name: String,
        questionCats: []
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(assessments) {
        // Use data from previous result in next test
        frisby.create('Get first Assessment by Id')
            .get(URL + '/' + assessments[0].id)
            .expectStatus(200)
            .expectJSON({
                name: String,
                questionCats: []
            }).
            afterJSON(function(assessment) {
                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0].id + '/results')
                    .expectStatus(204)
                    .toss();

                frisby.create('post a first answer for this assessment')
                    .post(URL + '/' + assessments[0].id + '/results',
                        {owner: '525fb247101e330000001008',
                            assessment: assessments[0].id,
                            timestamp: new Date(),
                            answers:
                                [
                                    {assessment: assessments[0].id,
                                    question: '5278c51a6166f2de240000cc',
                                    answer: -23,
                                    answered: true},
                                    {assessment: assessments[0].id,
                                    question: '5278c51a6166f2de240000cb',
                                    answer: 23,
                                    answered: true}
                                ]
                        }, { json: true } )
                    .expectStatus(201)
                    .toss();

                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0].id + '/results')
                    .expectStatus(200)
                    .expectJSONLength(1)
                    .toss();

                var newDate = new Date();

                frisby.create('post a second answer for this assessment')
                    .post(URL + '/' + assessments[0].id + '/results',
                    {owner: '525fb247101e330000001008',
                        assessment: assessments[0].id,
                        timestamp: newDate,
                        answers:
                            [
                                {assessment: assessments[0].id,
                                    question: '5278c51a6166f2de240000cc',
                                    answer: -100,
                                    answered: true},
                                {assessment: assessments[0].id,
                                    question: '5278c51a6166f2de240000cb',
                                    answer: 23,
                                    answered: true}
                            ]
                    }, { json: true } )
                    .expectStatus(201)
                    .toss();

                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0].id + '/results')
                    .expectStatus(200)
                    .expectJSONLength(2)
                    .toss();

                frisby.create('get newest answers for this assessment')
                    .get(URL + '/' + assessments[0].id + '/results/newest')
                    .expectStatus(200)
                    .expectJSON({
                            owner: '525fb247101e330000001008',
                            timestamp: newDate.toJSON()
                        }
                    )
                    .toss();

                frisby.create('delete all answers for this assessment')
                    .delete(URL + '/' + assessments[0].id + '/results')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();
