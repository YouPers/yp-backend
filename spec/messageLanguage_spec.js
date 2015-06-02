var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts'),
    moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});


// campaign wide messages, post as invalid author, important flag, language flag

// note: system wide messages can't not be tested well here
// because they would conflict with the other specs in our concurrent test suite

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
                    author: consts.users.test_ind1.id,
                    targetSpaces: [
                        {
                            type: 'campaign',
                            targetId: campaign.id
                        }
                    ],

                    title: 'Hello ' + user.firstname + '!',
                    text: 'Welcome to our terrific campaign!',
                    refDocs: [
                        { docId: campaign.id, model: 'Campaign'}
                    ],

                    important: true,

                    publishFrom: moment().toDate(),
                    publishTo: moment().add(1, 'minutes').toDate()

                };


                frisby.create('Message: fail to post a message being not the author')
                    .post(URL + '/messages', message)
                    .auth(consts.users.test_ind2.username, 'yp')
                    .expectStatus(403)
                    .afterJSON(function (message) {

                    })
                    .toss();

                message.author = consts.users.test_prodadm.id;

                frisby.create('Message: post important message without language')
                    .post(URL + '/messages', message)
                    .auth(consts.users.test_prodadm.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (message) {

                        frisby.create('Message: get inbox, will contain 1 message')
                            .get(URL + '/socialInteractions')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (socialInteractions) {
                                expect(socialInteractions.length).toEqual(1);
                                expect(socialInteractions[0].important).toBeTruthy();

                                frisby.create('Message: delete the message as admin')
                                    .delete(URL + '/socialInteractions/' + message.id + '?mode=administrate')
                                    .auth(consts.users.test_prodadm.username, 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('Message: get inbox, no more messages')
                                            .get(URL + '/messages')
                                            .auth(consts.users.test_prodadm.username, 'yp')
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
                    author: consts.users.test_prodadm.id,
                    targetSpaces: [
                        {
                            type: 'campaign',
                            targetId: campaign.id
                        }
                    ],

                    title: 'Hello ' + user.firstname + '!',
                    text: 'Welcome to our terrific campaign!',
                    refDocs: [
                        { docId: campaign.id, model: 'Campaign'}
                    ],

                    language: 'de',

                    publishFrom: moment().toDate(),
                    publishTo: moment().add(1, 'minutes').toDate()

                };


                frisby.create('Message: post "de" message')
                    .post(URL + '/messages', message)
                    .auth(consts.users.test_prodadm.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (message) {

                        frisby.create('Message: get "de" message with no language set in user profile')
                            .get(URL + '/socialInteractions')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (socialInteractions) {
                                expect(socialInteractions.length).toEqual(1);
                                expect(socialInteractions[0].language).toEqual('de');

                                var profile = {
                                    prefs: {
                                        "calendarNotification": "900",
                                        "defaultWorkWeek": ["MO", "TU", "WE", "TH", "FR"],
                                        "email": {
                                            "actPlanInvites": true,
                                            "dailyUserMail": false,
                                            "iCalInvites": false
                                        },
                                        rejectedIdeas: [],
                                        "rejectedActivityPlans": [],
                                        "starredIdeas": []
                                    },
                                    language: "fr"
                                };

                                frisby.create('Message: set profile language to "fr"')
                                    .put(URL + '/profiles/' + user.profile, profile)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (updatedProfile) {

                                        frisby.create('Message: no german message for french user')
                                            .get(URL + '/socialInteractions')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);

                                                profile.language = 'de';

                                                frisby.create('Message: set profile language to "de"')
                                                    .put(URL + '/profiles/' + user.profile, profile)
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (updatedProfile) {

                                                        frisby.create('Message: get german message as german user')
                                                            .get(URL + '/socialInteractions')
                                                            .auth(user.username, 'yp')
                                                            .expectStatus(200)
                                                            .afterJSON(function (socialInteractions) {
                                                                expect(socialInteractions.length).toEqual(1);
                                                                expect(socialInteractions[0].language).toEqual('de');

                                                                frisby.create('Message: delete the message as author')
                                                                    .delete(URL + '/socialInteractions/' + message.id)
                                                                    .auth(consts.users.test_prodadm.username, 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function () {

                                                                        frisby.create('Message: no more messages')
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