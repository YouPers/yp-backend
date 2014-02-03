var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/assessments';
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});


frisby.create('GET all assessments')
    .get(URL)
    .auth('test_ind1', 'yp')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        name: String,
        questionCats: []
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function (assessments) {
        // Use data from previous result in next test
        frisby.create('Get first Assessment by Id')
            .get(URL + '/' + assessments[0].id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .expectJSON({
                name: String,
                questionCats: []
            }).
            afterJSON(function (assessment) {


                frisby.create('post a first answer for this assessment')
                    .post(URL + '/' + assessments[0].id + '/results',
                    {owner: consts.users.test_ind1.id,
                        assessment: assessments[0].id,
                        timestamp: new Date(),
                        answers: [
                            {assessment: assessments[0].id,
                                question: '5278c51a6166f2de240000cc',
                                answer: -23,
                                answered: true},
                            {assessment: assessments[0].id,
                                question: '5278c51a6166f2de240000cb',
                                answer: 23,
                                answered: true}
                        ]
                    })
                    .auth('test_ind1', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (newAnswer) {
                        frisby.create('get answers for this assessment 2nd time')
                            .get(URL + '/' + assessments[0].id + '/results')
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (answerList) {

                                var newDate = new Date();

                                frisby.create('post a second answer for this assessment')
                                    .post(URL + '/' + assessments[0].id + '/results',
                                    {owner: consts.users.test_ind1.id,
                                        assessment: assessments[0].id,
                                        timestamp: newDate,
                                        answers: [
                                            {assessment: assessments[0].id,
                                                question: '5278c51a6166f2de240000cc',
                                                answer: -100,
                                                answered: true},
                                            {assessment: assessments[0].id,
                                                question: '5278c51a6166f2de240000cb',
                                                answer: 23,
                                                answered: true}
                                        ]
                                    })
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (newerAnswer) {

                                        frisby.create('get answers for this assessment 3rd time')
                                            .get(URL + '/' + assessments[0].id + '/results')
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .expectJSONLength(answerList.length + 1)
                                            .afterJSON(function (newestAnswerList) {
                                                frisby.create('get newest answers for this assessment')
                                                    .get(URL + '/' + assessments[0].id + '/results/newest')
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .expectJSON({
                                                        owner: consts.users.test_ind1.id,
                                                        timestamp: newDate.toJSON()
                                                    }
                                                )
                                                    .afterJSON(function () {

                                                        frisby.create('delete first answers for this assessment')
                                                            .auth('test_ind1', 'yp')
                                                            .delete(URL + '/' + assessments[0].id + '/results/' + newAnswer.id)
                                                            .expectStatus(200)
                                                            .toss();

                                                        frisby.create('delete second answers for this assessment')
                                                            .auth('test_ind1', 'yp')
                                                            .delete(URL + '/' + assessments[0].id + '/results/' + newerAnswer.id)
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
    .toss();
