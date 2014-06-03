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

        frisby.create('ActivityOffers: get offers (no campaign, no invites, no assessment --> just 8 default offers')
            .get(URL + '/activityoffers')
            .auth(offerTestUser.username, "yp")
            .expectStatus(200)
            .afterJSON(function (recs) {
                expect(recs.length).toEqual(8);
            })
            .toss();

        frisby.create('ActivityOffers: post a first answer for this assessment')
            .post(URL + '/assessments/525faf0ac558d40000000005/results',
            {owner: offerTestUser,
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
            .auth(offerTestUser.username, "yp")
            .expectStatus(201)
            .afterJSON(function (json) {
                frisby.create('ActivityOffers: get offers, coachAnswers only')
                    .get(URL + '/activityoffers')
                    .auth(offerTestUser.username, "yp")
                    .expectStatus(200)
                    .afterJSON(function (recs) {

                        expect(recs.length).toEqual(8);

                        _.forEach(recs, function (rec) {
                            expect(rec.offerType[0]).toEqual('ypHealthCoach');
                            expect(rec.activity.id).toBeDefined();
                            expect(rec.offerType.length).toEqual(1);
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
                                        expect(recs.length).toEqual(8);
                                        _.forEach(recs, function (rec) {
                                            expect(rec.offerType[0]).toEqual('ypHealthCoach');
                                            expect(rec.activity.id).toBeDefined();
                                            expect(rec.offerType.length).toEqual(1);
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
                                                offerType: ['campaignActivity'],
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

                                                        expect(recs.length).toEqual(9);
                                                        expect(recs[0].offerType[0]).toEqual('campaignActivity');
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

                                                                frisby.create('ActivityOffers: get offers, with CampaignAct, but no CampaignActPlan-Offer because the for CampaignActPlans the offer has to be submitted explicitly')
                                                                    .get(URL + '/activityoffers')
                                                                    .auth(offerTestUser.username, "yp")
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (recs) {


                                                                        expect(recs.length).toEqual(9);
                                                                        expect(recs[0].offerType).toContain('campaignActivity'); // next by rank, personalInvitation not available
                                                                        expect(recs[1].offerType).toContain('ypHealthCoach'); // preferred type


                                                                        frisby.create('ActivityOffers: post ActivityOffer for CampaignPlan')
                                                                            .post(URL + '/activityoffers', {
                                                                                activity: consts.groupActivity2.id,
                                                                                recommendedBy: ['52a97f1650fca98c2900000b'],
                                                                                targetQueue: myTestCampaign.id,
                                                                                offerType: ['campaignActivityPlan'],
                                                                                prio: ['100'],
                                                                                plan: [campActPlan.id]
                                                                            })
                                                                            .auth('test_campaignlead', 'yp')
                                                                            .expectStatus(201)
                                                                            .afterJSON(function (campaignActPlanOffer) {


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

                                                                                                expect(recs.length).toEqual(9);

                                                                                                expect(recs[0].offerType).toContain('campaignActivity'); // next by rank
                                                                                                expect(recs[0].offerType).not.toContain('campaignActivityPlan'); // joined plan should not show up anymore
                                                                                                expect(recs[1].offerType).toContain('ypHealthCoach'); // preferred type

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

            })
            .toss();

    });
