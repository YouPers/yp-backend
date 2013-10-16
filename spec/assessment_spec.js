var frisby = require('frisby');
require('../app.js');
var port = process.env.PORT || 3000;
var URL = 'http://localhost:'+ port +'/api/v1/assessments';


frisby.create('GET all assessments')
    .get(URL)
    .expectStatus(200)
    .expectJSON('*', {
        _id: String,
        name: String,
        questionCats: []
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(assessments) {
        // Use data from previous result in next test
        frisby.create('Get first Assessment by Id')
            .get(URL + '/' + assessments[0]._id)
            .expectStatus(200)
            .expectJSON({
                name: String,
                questionCats: []
            }).
            afterJSON(function(assessment) {
                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0]._id + '/results')
                    .expectStatus(200)
                    .expectJSONLength(0)
                    .toss();

                frisby.create('post a first answer for this assessment')
                    .post(URL + '/' + assessments[0]._id + '/results',
                        {owner: '525e5ae3ef9673a352000001',
                            assessment: assessments[0]._id,
                            timestamp: new Date(),
                            answers:
                                [
                                    {assessment: assessments[0]._id,
                                    question: '525e5ae3ef9673a352000004',
                                    answer: -23,
                                    answered: true},
                                    {assessment: assessments[0]._id,
                                    question: '525e5ae3ef9673a352000006',
                                    answer: 23,
                                    answered: true}
                                ]
                        }, { json: true } )
                    .expectStatus(201)
                    .toss();

                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0]._id + '/results')
                    .expectStatus(200)
                    .expectJSONLength(1)
                    .toss();

                var newDate = new Date();

                frisby.create('post a second answer for this assessment')
                    .post(URL + '/' + assessments[0]._id + '/results',
                    {owner: '525e5ae3ef9673a352000001',
                        assessment: assessments[0]._id,
                        timestamp: newDate,
                        answers:
                            [
                                {assessment: assessments[0]._id,
                                    question: '525e5ae3ef9673a352000004',
                                    answer: -100,
                                    answered: true},
                                {assessment: assessments[0]._id,
                                    question: '525e5ae3ef9673a352000006',
                                    answer: 23,
                                    answered: true}
                            ]
                    }, { json: true } )
                    .expectStatus(201)
                    .toss();

                frisby.create('get answers for this assessment')
                    .get(URL + '/' + assessments[0]._id + '/results')
                    .expectStatus(200)
                    .expectJSONLength(2)
                    .toss();

                frisby.create('get newest answers for this assessment')
                    .get(URL + '/' + assessments[0]._id + '/results/newest')
                    .expectStatus(200)
                    .expectJSON({
                            owner: '525e5ae3ef9673a352000001',
                            timestamp: newDate.toJSON()
                        }
                    )
                    .toss();

                frisby.create('delete all answers for this assessment')
                    .delete(URL + '/' + assessments[0]._id + '/results')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();
