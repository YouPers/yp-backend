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
                publishFrom: moment(),
                publishTo: moment().add('hours', 1),

                refDocs: [
                    { docId: consts.aloneIdea.id, model: 'Idea'}
                ],
                idea: consts.aloneIdea.id
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
                            "start": moment().add('days', 1),
                            "end": moment().add('days', 1).add('hours', 2),
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
                                publishFrom: moment(),
                                publishTo: moment().add('hours', 1),

                                refDocs: [
                                    { docId: newPlan.id, model: 'Activity'}
                                ]
                            })
                            .auth(consts.users.test_campaignlead.username, 'yp')
                            .expectStatus(201)
                            .afterJSON(function (recommendation) {

                                frisby.create('CampaignOffers: get current campaign offers')
                                    .get(URL + '/campaigns/' + campaign.id + '/offers')
                                    .auth(consts.users.test_campaignlead.username, "yp")
                                    .expectStatus(200)
                                    .afterJSON(function (campaignOffers) {

                                    })
                                    .toss();

                            })
                            .toss();

                    })
                    .toss();

            })
            .toss();

    });