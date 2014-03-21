var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    bunyan = require('bunyan'),
    log = bunyan.createLogger({name: 'testlogger'}),
    consts = require('./testconsts');

var testcampaign = {id: '527916a82079aa8704000006'};


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

var offerTestUser = {
    username: 'new_unittest_user_offers',
    fullname: 'Testing Unittest',
    firstname: 'Testing',
    lastname: 'Unittest',
    email: 'ypunittest1+new_unittest_user_offers@gmail.com',
    password: 'nopass'
};

frisby.create('User: POST new user')
    .post(URL + '/users', offerTestUser)
    .expectStatus(201)
    .afterJSON(function (testUser) {


        frisby.create('ActivityOffers: get offers (no campaign, no invites, no assessment --> no recs')
            .get(URL + '/activities/offers')
            .auth(offerTestUser.username, offerTestUser.password)
            .expectStatus(200)
            .afterJSON(function (recs) {
                expect(recs.length).toEqual(0);
            })
            .toss();

        frisby.create('ActivityOffers: post a first answer for this assessment')
            .post(URL + '/assessments/525faf0ac558d40000000005/results',
            {owner: testUser.id,
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
            .auth(offerTestUser.username, offerTestUser.password)
            .expectStatus(201)
            .afterJSON(function (json) {
                frisby.create('ActivityOffers: get offers, coachAnswers only')
                    .get(URL + '/activities/offers')
                    .auth(offerTestUser.username, offerTestUser.password)
                    .expectStatus(200)
                    .afterJSON(function (recs) {
                        expect(recs.length).toEqual(6);

                        _.forEach(recs, function (rec) {
                            expect(rec.type[0]).toEqual('ypHealthCoach');
                            expect(rec.activity.id).toBeDefined();
                            expect(rec.type.length).toEqual(1);
                            expect(rec.activity.recWeights).toBeUndefined();
                            expect(rec.activityPlan.length).toEqual(0);
                            expect(rec.recommendedBy.length).toEqual(1);
                            expect(rec.recommendedBy[0].id).toEqual('yphealthcoach');
                        });

                        offerTestUser.campaign = testcampaign.id;
                        frisby.create('ActivityOffers: add the user to the campaign')
                            .put(URL + '/users/' + testUser.id, offerTestUser)
                            .auth(offerTestUser.username, offerTestUser.password)
                            .expectStatus(200)
                            .after(function () {
                                frisby.create('ActivityOffers: get offers, coachAnswers only, no campaign Acts yet')
                                    .get(URL + '/activities/offers')
                                    .auth(offerTestUser.username, offerTestUser.password)
                                    .expectStatus(200)
                                    .afterJSON(function (recs) {
                                        expect(recs.length).toEqual(6);
                                        _.forEach(recs, function (rec) {
                                            expect(rec.type[0]).toEqual('ypHealthCoach');
                                            expect(rec.activity.id).toBeDefined();
                                            expect(rec.type.length).toEqual(1);
                                            expect(rec.activity.recWeights).toBeUndefined();
                                            expect(rec.activityPlan.length).toEqual(0);
                                            expect(rec.recommendedBy.length).toEqual(1);
                                            expect(rec.recommendedBy[0].id).toEqual('yphealthcoach');
                                        });

                                        frisby.create('ActivityOffers: add a campaignAct ')
                                            .post(URL + '/activities', {
                                                "title": "Test Campaign Activity",
                                                "text": "New Test Campaign Activity Text",
                                                "campaign": testcampaign.id
                                            })
                                            .auth('test_campaignlead', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (campAct) {
                                                frisby.create('ActivityOffers: get offers, with CampaignAct')
                                                    .get(URL + '/activities/offers')
                                                    .auth(offerTestUser.username, offerTestUser.password)
                                                    .expectStatus(200)
                                                    .afterJSON(function (recs) {
                                                        expect(recs.length).toEqual(6);
                                                        expect(recs[0].type[0]).toEqual('campaignActivity');
                                                        expect(recs[0].prio[0]).toBeGreaterThan(recs[1].prio[0]);


                                                        frisby.create('ActivityOffers: add campaign ActPlan for existing Act')
                                                            .post(URL + '/activityplans', {
                                                                "owner": consts.users.test_campaignlead.id,
                                                                "activity": consts.groupActivity.id,
                                                                "title": "myTitle",
                                                                "visibility": "campaign",
                                                                "source": "campaign",
                                                                "campaign": testcampaign.id,
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
                                                                    .get(URL + '/activities/offers')
                                                                    .auth(offerTestUser.username, offerTestUser.password)
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (recs) {
                                                                        expect(recs.length).toEqual(6);
                                                                        expect(recs[0].type[0]).toEqual('campaignActivityPlan');
                                                                        expect(recs[1].type[0]).toEqual('campaignActivity');
                                                                        expect(recs[0].prio[0]).toBeGreaterThan(recs[1].prio[0]);

                                                                        frisby.create('ActivityOffers: removeCampaignAct')
                                                                            .delete(URL + '/activities/' + campAct.id)
                                                                            .auth('test_sysadm', 'yp')
                                                                            .expectStatus(200)
                                                                            .toss();

                                                                        frisby.create('ActivityOffers: removeCampaignActPlan')
                                                                            .delete(URL + '/activityplans/' + campActPlan.id)
                                                                            .auth('test_sysadm', 'yp')
                                                                            .expectStatus(200)
                                                                            .toss();

                                                                        frisby.create('ActivityOffers: remove AssessmentResults')
                                                                            .delete(URL + '/assessments/525faf0ac558d40000000005/results')
                                                                            .auth(offerTestUser.username, offerTestUser.password)
                                                                            .expectStatus(200)
                                                                            .after(function () {
                                                                                frisby.create('ActivityOffers: remove User')
                                                                                    .delete(URL + '/users/' + testUser.id)
                                                                                    .auth('test_sysadm', 'yp')
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

                    })
                    .toss();

            })
            .toss();

    }).toss();