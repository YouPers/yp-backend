var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts'),
    moment = require('moment');

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
        frisby.create('Message: get inbox, will be empty')
            .get(URL + '/socialInteractions')
            .auth(user.username, 'yp')
            .expectStatus(200)
            .afterJSON(function (socialInteractions) {
                expect(socialInteractions.length).toEqual(0);

                var message = {
                    author: '52d4f515fac246174c000006',
                    targetSpaces: [{
                        type: 'user',
                        targetId: user.id,
                        targetModel: 'User'
                    }],

                    title: 'Hello ' + user.firstname + '!',
                    text: 'Have a look at our awesome new campaign!',
                    refDocs: [{ docId: campaign.id, model: 'Campaign'}]

                };

                frisby.create('Message: post message to user')
                    .post(URL + '/messages', message)
                    .auth('test_prodadm', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (message) {

                        frisby.create('Message: get inbox, will contain 1 new message')
                            .get(URL + '/socialInteractions')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (socialInteractions) {
                                expect(socialInteractions.length).toEqual(1);

                                var msg = socialInteractions[0];

                                expect(msg.title).toEqual(message.title);

                                frisby.create('Message: dismiss the message')
                                    .delete(URL + '/socialInteractions/' + msg.id)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .after(function() {

                                        frisby.create('Message: get inbox, will be empty again')
                                            .get(URL + '/socialInteractions')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);
                                            })
                                            .toss();
                                    })
                                    .toss();
                            })
                            .toss();
                    })
                    .toss();
            })
            .toss()
    });