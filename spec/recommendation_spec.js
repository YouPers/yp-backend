var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    consts = require('./testconsts'),
    moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

// campaign wide recommendations

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }


        frisby.create('Recommendations: get recommendations for new user, expect 0')
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
                        publishFrom: moment().toDate(),
                        publishTo: moment().add(1, 'hours').toDate(),
                        authorType: 'campaignLead',
                        refDocs: [
                            { docId: consts.aloneIdea.id, model: 'Idea'}
                        ],
                        idea: consts.aloneIdea.id
                    })
                    .auth(consts.users.test_campaignlead.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (recommendation) {

                        frisby.create('Recommendations: get recommendations for new user, expect 1')
                            .get(URL + '/recommendations')
                            .auth(user.username, "yp")
                            .expectStatus(200)
                            .afterJSON(function (recs) {
                                expect(recs.length).toEqual(1);
                                expect(recs[0].targetSpaces[0].type).toEqual('campaign');
                                expect(recs[0].targetSpaces[0].targetId).toEqual(campaign.id);

                                frisby.create('Recommendations: get recs as campaignlead for administration')
                                    .get(URL + '/recommendations?targetId='+ campaign.id + '&authorType=campaignLead&authored=true')
                                    .auth(consts.users.test_campaignlead.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (recsAsCL) {
                                        expect(recsAsCL.length).toBe(1);

                                        frisby.create('Recommendations: delete the recommendation as system admin')
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
            })
            .toss();
    });


