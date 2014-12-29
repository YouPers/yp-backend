var ypbackendlib = require('ypbackendlib');
var config = require('../src/config/config');
var modelNames = require('../src/models').modelNames;
var _ = require('lodash');

var schemaNames = ['user']; // schema names to be extended
var modelPath = __dirname + '/../src/models'; // path the schema extensions are located
var schemaExtensions = {};
_.forEach(schemaNames, function (name) {
    schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
});
ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);

var CoachRecommendation = require('../src/core/CoachRecommendation');
var consts = require('./testconsts');

var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    async = require('async'),
    consts = require('./testconsts'),
    moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

describe('CoachRecommendation Module', function () {

    it('should correctly calculate recs for a user with a give AssessmentResult', function (done) {

        var assResult = {owner: consts.users.test_ind1.id,
            assessment: '525faf0ac558d40000000005',
            answers: [
                {assessment: '525faf0ac558d40000000005',
                    question: '5278c51a6166f2de240000cc',
                    answer: -100,
                    answered: true},
                {assessment: '525faf0ac558d40000000005',
                    question: '5278c51a6166f2de240000cb',
                    answer: 100,
                    answered: true}
            ]
        };
        var options = {
            topic: consts.topic.id,
            assessmentResult: assResult,
            nrOfRecsToReturn: 5
        };
        CoachRecommendation.generateAndStoreRecommendations(consts.users.test_ind1.id, options, function (err, recs) {
            expect(err).toEqual(null);
            expect(recs.length).toBeGreaterThan(0);
            expect(recs.length).toBeLessThan(6);
            expect(recs[0].score >= recs[1].score).toBe(true);
            expect(recs[1].score >= recs[2].score).toBe(true);
            return done();
        });

    });
});

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }


        frisby.create('Recommendations: get no recommendations with no assessment done yet')
            .get(URL + '/recommendations')
            .auth(user.username, "yp")
            .expectStatus(200)
            .afterJSON(function (recs) {
                expect(recs.length).toEqual(0);
            })
            .toss();


        frisby.create('Recommendations: put a first answer for this assessment')
            .put(URL + '/assessments/525faf0ac558d40000000005/answers/5278c51a6166f2de240000cc',
            {assessment: '525faf0ac558d40000000005',
                question: '5278c51a6166f2de240000cc',
                answer: -23,
                answered: true}
        )
            .auth(user.username, "yp")
            .expectStatus(200)
            .after(function () {
                frisby.create('Recommendations: put a second answer for this assessment')
                    .put(URL + '/assessments/525faf0ac558d40000000005/answers/5278c51a6166f2de240000cb',
                    {assessment: '525faf0ac558d40000000005',
                        question: '5278c51a6166f2de240000cb',
                        answer: 23,
                        answered: true})
                    .auth(user.username, "yp")
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('Recommendations: regenerate recommendations')
                            .get(URL + '/coachRecommendations?store=true')
                            .auth(user.username, "yp")
                            .expectStatus(200)
                            .afterJSON(function (recs) {
                                frisby.create('Recommendations: get recommendations')
                                    .get(URL + '/recommendations')
                                    .auth(user.username, "yp")
                                    .expectStatus(200)
                                    .afterJSON(function (recs) {

                                        expect(recs.length).toEqual(1);

                                        _.forEach(recs, function (rec) {
                                            expect(rec.author).toEqual(consts.users.yphealthcoach.id);
                                        });

                                        var idea = recs[0].idea;

                                        frisby.create('Recommendations: plan a recommended activity')
                                            .post(URL + '/activities', {
                                                "owner": user,
                                                "idea": idea,
                                                "campaign": campaign.id,
                                                "title": "myTitle",
                                                "executionType": "group",
                                                "start": moment(),
                                                "end": moment().add(2, 'hours'),
                                                "allDay": false,
                                                "frequency": "once",
                                                "status": "active"
                                            })
                                            .auth(user.username, 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (newPlan) {

                                                frisby.create('Recommendations: get recommendations without the already planned idea, but with another one')
                                                    .get(URL + '/recommendations')
                                                    .auth(user.username, "yp")
                                                    .expectStatus(200)
                                                    .afterJSON(function (recsWithoutPlannedIdea) {

                                                        expect(recsWithoutPlannedIdea.length).toEqual(1);

                                                        _.forEach(recsWithoutPlannedIdea, function (rec) {
                                                            expect(rec.author).toEqual(consts.users.yphealthcoach.id);
                                                            expect(rec.idea).not.toEqual(idea);
                                                        });

                                                        frisby.create('Recommendations: regenerate recommendations again, to check whether we do duplicate them')
                                                            .get(URL + '/coachRecommendations')
                                                            .auth(user.username, "yp")
                                                            .expectStatus(200)
                                                            .afterJSON(function (coachRecs) {

                                                                frisby.create('Recommendations: get recommendations after regeneration without the already planned idea')
                                                                    .get(URL + '/recommendations')
                                                                    .auth(user.username, "yp")
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (newRecs) {

                                                                        expect(newRecs.length).toEqual(1);
//
                                                                        _.forEach(newRecs, function (rec) {
                                                                            expect(rec.idea).not.toEqual(idea);
                                                                        });


                                                                        async.each(newRecs, function (rec, done) {
                                                                            frisby.create('Recommendations: dismiss the message anyway')
                                                                                .delete(URL + '/socialInteractions/' + rec.id)
                                                                                .auth(user.username, 'yp')
                                                                                .expectStatus(200)
                                                                                .after(function () {
                                                                                    done();
                                                                                })
                                                                                .toss();
                                                                        }, function (err) {
                                                                            // if any of the file processing produced an error, err would equal that error
                                                                            expect(err).toBeUndefined();

                                                                            frisby.create('Recommendations: remove AssessmentResults')
                                                                                .delete(URL + '/assessments/525faf0ac558d40000000005/results')
                                                                                .auth(user.username, 'yp')
                                                                                .expectStatus(200)
                                                                                .toss();

                                                                            cleanupFn();
                                                                        });
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
            .toss();
    });