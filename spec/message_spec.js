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


// personal user message

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
                        targetId: user.id
                    }],

                    title: 'Hello ' + user.firstname + '!',
                    text: 'Have a look at our awesome new campaign!',
                    refDocs: [{ docId: campaign.id, model: 'Campaign'}],

                    publishFrom: moment(),
                    publishTo: moment().add('minutes', 1)
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
            .toss()
    });


// campaign wide message


consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }


        consts.newUserInNewCampaignApi(
            function (err2, user2, campaign2, cleanupFn2) {

                if (err2) {
                    expect(err2).toBeNull();
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
                                type: 'campaign',
                                targetId: campaign.id
                            }],

                            title: 'Hello ' + user.firstname + '!',
                            text: 'Welcome to our terrific campaign!',
                            refDocs: [{ docId: campaign.id, model: 'Campaign'}],

                            publishFrom: moment(),
                            publishTo: moment().add('minutes', 1)

                        };

                        frisby.create('Message: post message to campaign')
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

                                        frisby.create('Message: get inbox with another user not in the same campaign, no messages')
                                            .get(URL + '/socialInteractions')
                                            .auth(user2.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);

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

                                                                frisby.create('Message: delete the message as admin')
                                                                    .delete(URL + '/socialInteractions/' + msg.id + '?mode=administrate')
                                                                    .auth(consts.users.test_prodadm.username, 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function () {
                                                                        cleanupFn();
                                                                        cleanupFn2();
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


    });


// campaign wide message in the future

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
                        type: 'campaign',
                        targetId: campaign.id
                    }],

                    title: 'Hello ' + user.firstname + '!',
                    text: 'Welcome to our terrific campaign!',
                    refDocs: [{ docId: campaign.id, model: 'Campaign'}],

                    publishFrom: moment().add('minutes', 1),
                    publishTo: moment().add('minutes', 2)

                };

                frisby.create('Message: post message to campaign')
                    .post(URL + '/messages', message)
                    .auth('test_prodadm', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (message) {

                        frisby.create('Message: get inbox, will not contain a new message right now')
                            .get(URL + '/socialInteractions')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (socialInteractions) {
                                expect(socialInteractions.length).toEqual(0);

                                frisby.create('Message: delete the message as admin')
                                    .delete(URL + '/socialInteractions/' + message.id + '?mode=administrate')
                                    .auth(consts.users.test_prodadm.username, 'yp')
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
            .toss()
    });

