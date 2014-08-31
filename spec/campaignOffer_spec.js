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

        frisby.create('CampaignOffers: recommend an idea to the campaign ')
            .post(URL + '/recommendations', {

                targetSpaces: [
                    {
                        type: 'campaign',
                        targetId: campaign.id
                    }
                ],

                author: consts.users.test_campaignlead.id,
                authorType: 'campaignLead',
                publishFrom: moment(),
                publishTo: moment().add(1, 'hours'),

                refDocs: [
                    { docId: consts.groupIdea.id, model: 'Idea'}
                ],
                idea: consts.groupIdea.id
            })
            .auth(consts.users.test_campaignlead.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (recommendation) {


                frisby.create('CampaignOffers: plan an activity for an invitation')
                    .post(URL + '/activities', {
                        "owner": consts.users.test_ind1.id,
                        "idea": consts.groupIdea.id,
                        "title": "myTitle",
                        "visibility": "public",
                        "campaign": campaign.id,
                        "executionType": "group",
                        "mainEvent": {
                            "start": moment().subtract(1, 'days'),
                            "end": moment().add(1, 'days').subtract(2, 'hours'),
                            "allDay": false,
                            "frequency": "once"
                        },
                        "status": "active"
                    })
                    .auth('test_ind1', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (newPlan) {

                        frisby.create('CampaignOffers: invite users to activity ')
                            .post(URL + '/invitations', {

                                targetSpaces: [
                                    {
                                        type: 'campaign',
                                        targetId: campaign.id
                                    }
                                ],

                                author: consts.users.test_campaignlead.id,
                                authorType: 'campaignLead',
                                publishFrom: moment(),
                                publishTo: moment().add(1, 'hours'),

                                refDocs: [
                                    { docId: newPlan.id, model: 'Activity'}
                                ]
                            })
                            .auth(consts.users.test_campaignlead.username, 'yp')
                            .expectStatus(201)
                            .afterJSON(function (invitation) {

                                frisby.create('CampaignOffers: get current campaign offers as campaignLead')
                                    .get(URL + '/socialInteractions?targetId='+ campaign.id + '&authorType=campaignLead&authored=true')
                                    .auth(consts.users.test_campaignlead.username, "yp")
                                    .expectStatus(200)
                                    .afterJSON(function (campaignOffers) {

                                        expect(campaignOffers.length).toEqual(2);

                                    })
                                    .toss();

                                    user.campaign = campaign.id;

                                    frisby.create('CampaignOffers: join campaign with new user')
                                        .put(URL + '/users/' + user.id, user)
                                        .auth(user.username, 'yp')
                                        .expectStatus(200)
                                        .afterJSON(function (user2) {


                                            frisby.create('CampaignOffers: get offers as user')
                                                .get(URL + '/offers')
                                                .auth(user.username, "yp")
                                                .expectStatus(200)
                                                .afterJSON(function (offers) {

                                                    expect(offers.length).toEqual(2);

                                                    frisby.create('CampaignOffers: dismiss the recommendation, all offers for the rejected idea are dismissed')
                                                        .delete(URL + '/socialInteractions/' + recommendation.id + '?reason=denied')
                                                        .auth(user.username, 'yp')
                                                        .expectStatus(200)
                                                        .after(function () {

                                                            frisby.create('CampaignOffers: get offers as user')
                                                                .get(URL + '/offers')
                                                                .auth(user.username, "yp")
                                                                .expectStatus(200)
                                                                .afterJSON(function (offers) {

                                                                    expect(offers.length).toEqual(2);
                                                                    expect(_.countBy(offers, 'rejected').true).toEqual(2);
                                                                    expect(_.countBy(offers, 'dismissed').true).toEqual(1);
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