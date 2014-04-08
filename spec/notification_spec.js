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
                        frisby.create('Notifications: check notifications of user --> one notification')
                            .get(URL + '/notifications')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .expectJSONTypes('*', {
                                type: String,
                                author: String,
                                created: String,
                                id: String
                            })
                            .afterJSON(function (notifs) {
                                expect(notifs.length).toEqual(1);
                                expect(notifs[0].targetQueue).toEqual(campaign.id);
                                expect(notifs[0].author).toEqual(consts.users.test_campaignlead.id);

                                frisby.create('Notifications: post an Announcement to the Youpers Queue')
                                    .post(URL + '/notifications', {
                                        author: '52d4f515fac246174c000006',
                                        title: "new iPhone App from YouPers published",
                                        targetQueue: "AAAAc64e53d523235b07EEEE",
                                        type: "message"
                                    })
                                    .auth('test_prodadm', 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (newPublicNotif) {
                                        frisby.create('Notifications: check notifications of user --> one notification')
                                            .get(URL + '/notifications')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .expectJSONTypes('*', {
                                                type: String,
                                                title: String,
                                                author: String,
                                                created: String,
                                                id: String
                                            })
                                            .afterJSON(function (notifs) {
                                                expect(notifs.length).toEqual(2);
                                                frisby.create('Notification: delete public notifs')
                                                    .delete(URL + '/notifications/' + newPublicNotif.id)
                                                    .auth('test_sysadm', 'yp')
                                                    .expectStatus(200)
                                                    .toss();
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

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Notifications: post a campaignActivityPlan')
            .post(URL + '/activityplans', {
                "owner": consts.users.test_campaignlead.id,
                "activity": consts.groupActivity.id,
                "visibility": "campaign",
                "executionType": "group",
                "campaign": campaign.id,
                "title": "Teste deine Software jeden Tag",
                "mainEvent": {
                    "start": moment({hour: 8, minute: 0, second: 0}).add('days', 10),
                    "end": moment({hour: 9, minute: 0, second: 0}).add('days', 10),
                    "allDay": false,
                    "frequency": "day",
                    "recurrence": {
                        "endby": {
                            "type": "after",
                            "after": 6
                        },
                        "every": 1,
                        "exceptions": []
                    }
                },
                "status": "active",
                "source": "campaign"
            })
            .auth(consts.users.test_campaignlead.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (campaignPlan) {
                frisby.create('Notifications: check notifications of user --> one campaignPlan Notification')
                    .get(URL + '/notifications')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (notifs) {
                        expect(notifs.length).toEqual(1);
                        expect(notifs[0].type).toEqual('joinablePlan');

                        frisby.create('Notifications: cleanup')
                            .delete(URL + '/activityplans/' + campaignPlan.id)
                            .auth('test_sysadm', 'yp')
                            .expectStatus(200)
                            .toss();

                        frisby.create('Notifications: cleanup')
                            .delete(URL + '/notifications/' + notifs[0].id)
                            .auth('test_sysadm', 'yp')
                            .expectStatus(200)
                            .toss();
                        cleanupFn();

                    })
                    .toss();
            })
            .toss();
    });


consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Notifications: post an activityPlan SUCCESS')
            .post(URL + '/activityplans', {
                "owner": user.id,
                "activity": consts.groupActivity.id,
                "visibility": "campaign",
                "executionType": "group",
                "campaign": campaign.id,
                "title": "Always use unit tests",
                "mainEvent": {
                    "start": moment({hour: 8, minute: 0, second: 0}).add('days', 10),
                    "end": moment({hour: 9, minute: 0, second: 0}).add('days', 10),
                    "allDay": false,
                    "frequency": "day",
                    "recurrence": {
                        "endby": {
                            "type": "after",
                            "after": 6
                        },
                        "every": 1,
                        "exceptions": []
                    }
                },
                "status": "active"
            })
            .auth(user.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (myPlan) {
                frisby.create('Notifications: check notifications of user after public group plan post --> EMTPY')
                    .get(URL + '/notifications')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (notifs) {
                        expect(notifs.length).toEqual(0);

                        frisby.create("Notifications: invite test_ind3 user to this plan")
                            .post(URL + '/activityplans/' + myPlan.id + "/inviteEmail", {email: 'ypunittest1+individual3@gmail.com'})
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .after(function () {
                                frisby.create('Notifications: check notifications of user after public group plan post --> one notification')
                                    .get(URL + '/notifications')
                                    .auth('test_ind3', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (notifs) {
                                        expect(notifs.length).toBeGreaterThan(0);
                                        expect(_.map(notifs, 'type')).toContain('personalInvitation');

                                        frisby.create('Notifications: cleanup')
                                            .delete(URL + '/activityplans/' + myPlan.id)
                                            .auth('test_sysadm', 'yp')
                                            .expectStatus(200)
                                            .toss();

                                        frisby.create('Notifications: cleanup')
                                            .delete(URL + '/notifications/' + notifs[0].id)
                                            .auth('test_sysadm', 'yp')
                                            .expectStatus(200)
                                            .toss();


                                        cleanupFn();

                                    })
                                    .toss();
                            })
                            .toss();


                    })
                    .toss();
            })
            .toss();
    });

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Notifications: post an Announcement to the Users Queue, ')
            .post(URL + '/notifications', {
                author: '52d4f515fac246174c000006',
                title: "Perosnal Message to: " + user.username,
                targetQueue: user.id,
                type: "message",
                publishFrom: moment().subtract(1, 'h'),
                publishTo: moment().add(1, 'h')
            })
            .auth('test_prodadm', 'yp')
            .expectStatus(201)
            .afterJSON(function (notif) {
                frisby.create('Notifications: check notifications of user --> one notification')
                    .get(URL + '/notifications')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .expectJSONTypes('*', {
                        type: String,
                        author: String,
                        created: String,
                        id: String
                    })
                    .afterJSON(function (notifs) {
                        expect(_.map(notifs, 'id')).toContain(notif.id);

                        frisby.create('Notifications: post outdated an Announcement to the Users Queue, ')
                            .post(URL + '/notifications', {
                                author: '52d4f515fac246174c000006',
                                title: "OUTDATED Message to : " + user.username,
                                targetQueue: user.id,
                                type: "message",
                                publishFrom: moment().subtract(2, 'h'),
                                publishTo: moment().subtract(1, 'h')
                            })
                            .auth('test_prodadm', 'yp')
                            .expectStatus(201)
                            .afterJSON(function (notif) {
                                frisby.create('Notifications: check notifications of user --> outdated one not included')
                                    .get(URL + '/notifications')
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (notifs) {
                                        expect(_.map(notifs, 'id')).not.toContain(notif.id);


                                        frisby.create('Notifications: post a future Announcement to the Users Queue, ')
                                            .post(URL + '/notifications', {
                                                author: '52d4f515fac246174c000006',
                                                title: "FUTURE MESSAGE to: " + user.username,
                                                targetQueue: user.id,
                                                type: "message",
                                                publishFrom: moment().add(1, 'h'),
                                                publishTo: moment().add(2, 'h')
                                            })
                                            .auth('test_prodadm', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (notif) {
                                                frisby.create('Notifications: check notifications of user --> future one not included')
                                                    .get(URL + '/notifications')
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(200)
                                                    .expectJSONTypes('*', {
                                                        type: String,
                                                        author: String,
                                                        created: String,
                                                        id: String
                                                    })
                                                    .afterJSON(function (notifs) {
                                                        expect(_.map(notifs, 'id')).not.toContain(notif.id);
                                                        cleanupFn();

                                                        _.forEach(notifs, function(notif) {
                                                            frisby.create("Notifications: cleanup")
                                                                .delete(URL + '/notifications/' + notif.id)
                                                                .auth('test_sysadm', 'yp')
                                                                .expectStatus(200)
                                                                .toss();
                                                        });
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
