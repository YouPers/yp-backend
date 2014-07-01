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

// campaign wide recommendations

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }


        frisby.create('Recommendations: get no recommendations for new user')
            .get(URL + '/recommendations')
            .auth(user.username, "yp")
            .expectStatus(200)
            .afterJSON(function (recs) {
                expect(recs.length).toEqual(0);


                frisby.create('Recommendations: recommend an idea to the campaign ')
                    .post(URL + '/recommendations', {

                        targetSpaces: [
                            {
                                type: 'campaign',
                                targetId: campaign.id
                            }
                        ],

                        author: consts.users.test_campaignlead.id,
                        publishFrom: moment(),
                        publishTo: moment().add('hours', 1),

                        refDocs: [{ docId: consts.aloneIdea.id, model: 'Campaign'}],
                        idea: consts.aloneIdea.id
                    })
                    .auth(consts.users.test_campaignlead.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (recommendation) {

                        frisby.create('Recommendations: get no recommendations for new user')
                            .get(URL + '/recommendations')
                            .auth(user.username, "yp")
                            .expectStatus(200)
                            .afterJSON(function (recs) {
                                expect(recs.length).toEqual(1);
                                expect(recs[0].targetSpaces[0].type).toEqual('campaign');
                                expect(recs[0].targetSpaces[0].targetId).toEqual(campaign.id);

                                        frisby.create('Message: delete the recommendation as system admin')
                                    .delete(URL + '/socialInteractions/' + recs[0].id + '?mode=administrate')
                                    .auth('test_sysadm', 'yp')
                                    .expectStatus(200)
                                    .after(function () {
                                        cleanupFn();
                                    })
                                    .toss();

                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();
    });


// health coach recommendations

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


        frisby.create('Recommendations: post a first answer for this assessment')
            .post(URL + '/assessments/525faf0ac558d40000000005/results',
            {owner: user,
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
            .auth(user.username, "yp")
            .expectStatus(201)
            .afterJSON(function (json) {

                frisby.create('Recommendations: get recommendations from health coach only')
                    .get(URL + '/recommendations')
                    .auth(user.username, "yp")
                    .expectStatus(200)
                    .afterJSON(function (recs) {

                        expect(recs.length).toBeGreaterThan(6);
                        expect(recs.length).toBeLessThan(11);

                        _.forEach(recs, function(rec) {
                            expect(rec.author).toEqual(consts.users.yphealthcoach.id);
                        });

                        var idea = recs[0].idea;

                        frisby.create('Recommendations: plan a recommended activity')
                            .post(URL + '/activityplans', {
                                "owner": user,
                                "idea": idea,
                                "visibility": "public",
                                "campaign": campaign.id,
                                "title": "myTitle",
                                "executionType": "group",
                                "mainEvent": {
                                    "start": moment(),
                                    "end": moment().add('hours', 2),
                                    "allDay": false,
                                    "frequency": "once"
                                },
                                "status": "active"
                            })
                            .auth(user.username, 'yp')
                            .expectStatus(201)
                            .afterJSON(function (newPlan) {

                                frisby.create('Recommendations: get recommendations without the already planned idea')
                                    .get(URL + '/recommendations')
                                    .auth(user.username, "yp")
                                    .expectStatus(200)
                                    .afterJSON(function (newRecs) {

                                        expect(newRecs.length).toEqual(recs.length - 1);
                                        expect(_.map(newRecs, 'idea')).not.toContain(idea);

                                        async.each(newRecs, function(rec, done) {
                                            frisby.create('Message: dismiss the message anyway')
                                                .delete(URL + '/socialInteractions/' + rec.id)
                                                .auth(user.username, 'yp')
                                                .expectStatus(200)
                                                .after(function () {
                                                    done();
                                                })
                                                .toss();
                                        }, function(err) {
                                            // if any of the file processing produced an error, err would equal that error
                                            expect(err).toBeUndefined();
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
    });