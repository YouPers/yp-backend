var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

consts.newUserInNewCampaignApi(
    function (err, offerTestUser, myTestCampaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('ActivityOffers: get offers (no campaign, no invites, no assessment --> just 3 default offers')
            .get(URL + '/activityoffers')
            .auth(offerTestUser.username, "yp")
            .expectStatus(200)
            .afterJSON(function (recs) {
                expect(recs.length).toEqual(3);
            })
            .toss();

        frisby.create('ActivityOffers: post a first answer for this assessment')
            .post(URL + '/assessments/525faf0ac558d40000000005/results',
            {owner: offerTestUser,
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
            .auth(offerTestUser.username, "yp")
            .expectStatus(201)
            .afterJSON(function (json) {
                frisby.create('ActivityOffers: get offers, coachAnswers only')
                    .get(URL + '/activityoffers')
                    .auth(offerTestUser.username, "yp")
                    .expectStatus(200)
                    .afterJSON(function (recs) {

                        expect(recs.length).toEqual(5);

                        _.forEach(recs, function (rec) {
                            expect(rec.type[0]).toEqual('ypHealthCoach');
                            expect(rec.activity.id).toBeDefined();
                            expect(rec.type.length).toEqual(1);
                            expect(rec.activity.recWeights).toBeUndefined();
                            expect(rec.activityPlan.length).toEqual(0);
                            expect(rec.recommendedBy.length).toEqual(1);
                            expect(rec.recommendedBy[0].id).toEqual('53348c27996c80a534319bda');
                        });


                        offerTestUser.campaign = myTestCampaign.id;


                        frisby.create('ActivityOffers: add the user to the campaign')
                            .put(URL + '/users/' + offerTestUser.id, offerTestUser)
                            .auth(offerTestUser.username, "yp")
                            .expectStatus(200)
                            .after(function () {
                                frisby.create('ActivityOffers: get offers, coachAnswers only, no campaign Acts yet')
                                    .get(URL + '/activityoffers')
                                    .auth(offerTestUser.username, "yp")
                                    .expectStatus(200)
                                    .afterJSON(function (recs) {
                                        expect(recs.length).toEqual(5);
                                        _.forEach(recs, function (rec) {
                                            expect(rec.type[0]).toEqual('ypHealthCoach');
                                            expect(rec.activity.id).toBeDefined();
                                            expect(rec.type.length).toEqual(1);
                                            expect(rec.activity.recWeights).toBeUndefined();
                                            expect(rec.activityPlan.length).toEqual(0);
                                            expect(rec.recommendedBy.length).toEqual(1);
                                            expect(rec.recommendedBy[0].id).toEqual('53348c27996c80a534319bda');
                                        });

                                        frisby.create('ActivityOffers: promote a campaignAct ')
                                            .post(URL + '/activityoffers', {
                                                activity: consts.aloneActivity.id,
                                                recommendedBy: ['52a97f1650fca98c2900000b'],
                                                targetQueue: myTestCampaign.id,
                                                type: ['campaignActivity'],
                                                prio: ['100']
                                            })
                                            .auth('test_campaignlead', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (campActOffer) {
                                                frisby.create('ActivityOffers: get offers, with CampaignAct')
                                                    .get(URL + '/activityoffers')
                                                    .auth(offerTestUser.username, "yp")
                                                    .expectStatus(200)
                                                    .afterJSON(function (recs) {

                                                        expect(recs.length).toEqual(6);
                                                        expect(recs[0].type[0]).toEqual('campaignActivity');
                                                        expect(recs[0].prio[0]).toBeGreaterThan(recs[1].prio[0]);


                                                        frisby.create('ActivityOffers: add campaign ActPlan for existing Act')
                                                            .post(URL + '/activityplans', {
                                                                "owner": consts.users.test_campaignlead.id,
                                                                "activity": consts.groupActivity2.id,
                                                                "title": "myTitle",
                                                                "visibility": "campaign",
                                                                "source": "campaign",
                                                                "campaign": myTestCampaign.id,
                                                                "executionType": "group",
                                                                "mainEvent": {
                                                                    "start": "2014-06-16T12:00:00.000Z",
                                                                    "end": "2014-06-16T13:00:00.000Z",
                                                                    "allDay": false,
                                                                    "frequency": "once"
                                                                },
                                                                "status": "active"
                                                            })
                                                            .auth('test_campaignlead', 'yp')
                                                            .expectStatus(201)
                                                            .afterJSON(function (campActPlan) {

                                                                frisby.create('ActivityOffers: get offers, with CampaignActPlan and CampaignAct')
                                                                    .get(URL + '/activityoffers')
                                                                    .auth(offerTestUser.username, "yp")
                                                                    .expectStatus(200)
                                                                    .inspectJSON()
                                                                    .afterJSON(function (recs) {


                                                                        expect(recs.length).toEqual(7);
                                                                        expect(recs[0].type).toContain('campaignActivityPlan'); // preferred type
                                                                        expect(recs[1].type).toContain('ypHealthCoach'); // preferred type
                                                                        expect(recs[2].type).toContain('campaignActivity'); // next by rank, personalInvitation not available

                                                                        frisby.create('ActivityOffers: plan the campaignAct')
                                                                            .post(URL + '/activityplans/' + campActPlan.id + '/join')
                                                                            .auth(offerTestUser.username, "yp")
                                                                            .expectStatus(201)
                                                                            .afterJSON(function (slavePlan) {

                                                                                frisby.create('ActivityOffers: get offers, with CampaignActPlan and CampaignAct after planning, do not expect to get the planned one')
                                                                                    .get(URL + '/activityoffers')
                                                                                    .auth(offerTestUser.username, "yp")
                                                                                    .expectStatus(200)
                                                                                    .afterJSON(function (recs) {

                                                                                        expect(recs.length).toEqual(6);

                                                                                        expect(recs[0].type).toContain('campaignActivity'); // next by rank
                                                                                        expect(recs[0].type).not.toContain('campaignActivityPlan'); // joined plan should not show up anymore
                                                                                        expect(recs[1].type).toContain('ypHealthCoach'); // preferred type

                                                                                        frisby.create('ActivityOffers: removeCampaignActOffer')
                                                                                            .delete(URL + '/activityoffers/' + campActOffer.id)
                                                                                            .auth('test_sysadm', 'yp')
                                                                                            .expectStatus(200)
                                                                                            .toss();

                                                                                        frisby.create('ActivityOffers: removeCampaignActPlan')
                                                                                            .delete(URL + '/activityplans/' + campActPlan.id)
                                                                                            .auth('test_sysadm', 'yp')
                                                                                            .expectStatus(200)
                                                                                            .toss();

                                                                                        frisby.create('ActivityOffers: removePersonalOffers')
                                                                                            .delete(URL + '/activityoffers')
                                                                                            .auth(offerTestUser.username, "yp")
                                                                                            .expectStatus(200)
                                                                                            .toss();

                                                                                        frisby.create('ActivityOffers: remove AssessmentResults')
                                                                                            .delete(URL + '/assessments/525faf0ac558d40000000005/results')
                                                                                            .auth(offerTestUser.username, "yp")
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
                                    .toss();

                            })
                            .toss();

                    })
                    .toss();

            })
            .toss();

    });
