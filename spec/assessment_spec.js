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

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }



        frisby.create('Assessment: GET all assessments')
            .get(URL+'?populate=questions')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .expectJSON('*', {
                id: String,
                name: String,
                questions: []
            })
            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
            .afterJSON(function (assessments) {
                // Use data from previous result in next test
                frisby.create('Assessment: Get first Assessment by Id')
                    .get(URL + '/' + assessments[0].id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .expectJSON({
                        name: String,
                        questions: []
                    }).
                    afterJSON(function (assessment) {


                        frisby.create('Assessment: Get result with no answers yet')
                            .get(URL + '/' + assessments[0].id + '/results')
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (answerList) {


                                console.log(answerList);
                                return;

                                expect(answerList.length).toEqual(0);


                                var answer1 = {
                                    question: '5278c51a6166f2de240000cc',
                                    assessment: '525faf0ac558d40000000005',
                                    answer: 50
                                };
                                var answer2 = {
                                    question: '5278c51a6166f2de240000cb',
                                    assessment: '525faf0ac558d40000000005',
                                    answer: -50
                                };

                                frisby.create('Assessment: Put answer for questionId and create a new result for today')
                                    .put(URL + '/' + assessments[0].id + '/answers/' + answer1.question, answer1)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (answer) {

                                        expect(answer).toBeDefined();
                                        expect(answer.question).toEqual(answer1.question);
                                        expect(answer.assessment).toEqual(answer1.assessment);
                                        expect(answer.answer).toEqual(answer1.answer);

                                        frisby.create('Assessment: Get result with one answer')
                                            .get(URL + '/' + assessments[0].id + '/results')
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (answerList) {

                                                expect(answerList.length).toEqual(1);
                                                expect(answerList[0].question).toEqual(answer1.question);

                                                frisby.create('Assessment: Put 2nd answer for same result for today')
                                                    .put(URL + '/' + assessments[0].id + '/answers/' + answer2.question, answer2)
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (answer) {

                                                        expect(answer).toBeDefined();
                                                        expect(answer.question).toEqual(answer2.question);
                                                        expect(answer.assessment).toEqual(answer2.assessment);
                                                        expect(answer.answer).toEqual(answer2.answer);


                                                        frisby.create('Assessment: Get result from today with two answers')
                                                            .get(URL + '/' + assessments[0].id + '/results')
                                                            .auth('test_ind1', 'yp')
                                                            .expectStatus(200)
                                                            .afterJSON(function (answerList) {
                                                                expect(answerList.length).toEqual(2)

                                                                // cleanup
                                                                cleanupFn();

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


    });
