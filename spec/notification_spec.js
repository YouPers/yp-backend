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
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }
        frisby.create('Notifications: check notifications of user --> EMTPY')
            .get(URL + '/notifications')
            .auth(user.username, 'yp')
            .expectStatus(200)
            .afterJSON(function (notifs) {
                expect(notifs.length).toEqual(0);

                frisby.create('Notifications: promote a campaign Activity')
                    .post(URL + '/activityoffers', {
                        activity: consts.aloneActivity.id,
                        recommendedBy: [consts.users.test_campaignlead.id],
                        targetQueue: campaign.id,
                        type: ['campaignActivity'],
                        prio: ['100']
                    })
                    .auth(consts.users.test_campaignlead.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (activityOffer) {
                        frisby.create('Notifications: check notifications of user --> EMTPY')
                            .get(URL + '/notifications')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .inspectJSON()
                            .expectJSONTypes('*',{
                                type: String,
                                author: String,
                                created: String,
                                id: String
                            })
                            .afterJSON(function (notifs) {
                                expect(notifs.length).toEqual(1);
                                expect(notifs[0].targetQueue).toEqual(campaign.id);
                                expect(notifs[0].author).toEqual(consts.users.test_campaignlead.id);

//                                frisby.create('Notifications: post an Announcement to the Youpers Queue')
//                                    .post(URL + '/notifications', {
//                                        author: '52d4f515fac246174c000006',
//                                        title: "new iPhone App from YouPers published",
//                                        targetQueue: "AAAAc64e53d523235b07EEEE",
//                                        type: "message"
//                                    })
//                                    .auth('test_productadmin', 'yp')
//                                    .expectStatus(201)
//                                    .afterJSON(function(newNotif) {
//                                        cleanupFn();
//                                    })
//                                    .toss();





                            })
                            .toss();
                    })
                    .toss();


            })
            .toss();
    });
