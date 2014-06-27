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
        frisby.create('Notifications: check notifications of user --> EMPTY')
            .get(URL + '/notifications')
            .auth(user.username, 'yp')
            .expectStatus(200)
            .afterJSON(function (notifs) {
                expect(notifs.length).toEqual(0);

                frisby.create('Notifications: promote a campaign Activity')
                    .post(URL + '/activityoffers', {
                        idea: consts.aloneIdea.id,
                        recommendedBy: [consts.users.test_campaignlead.id],
                        targetQueue: campaign.id,
                        offerType: ['campaignActivity'],
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
                                        sourceType: 'youpers',
                                        type: "message"
                                    })
                                    .auth('test_prodadm', 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (newPublicNotif) {
                                        frisby.create('Notifications: check notifications of user --> two notifications')
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

                                                var activityNotification = _.find(notifs, { type: 'activityRecommendation' });
                                                var activityDoc = _.find(activityNotification.refDocs, { model: 'Idea'});

                                                frisby.create('Notifications: plan activity offer and check if it has been dismissed')
                                                    .post(URL + '/activityplans', {
                                                        "owner": user.id,
                                                        "idea": activityDoc.docId,
                                                        "visibility": "public",
                                                        "campaign": campaign.id,
                                                        "title": "myTitle",
                                                        "executionType": "self",
                                                        "mainEvent": {
                                                            "start": "2014-10-16T12:00:00.000Z",
                                                            "end": "2014-10-16T13:00:00.000Z",
                                                            "allDay": false,
                                                            "frequency": "once"
                                                        },
                                                        "status": "active"
                                                    })
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(201)
                                                    .afterJSON(function (newPlan) {

                                                        frisby.create('Notifications: check notifications of user --> now only one notification')
                                                            .get(URL + '/notifications')
                                                            .auth(user.username, 'yp')
                                                            .expectStatus(200)
                                                            .afterJSON(function (notifs) {


                                                                expect(notifs.length).toEqual(1);

                                                                frisby.create('cleanup the campaign promoted offer and notification')
                                                                    .delete(URL + '/activityoffers/' + activityOffer.id)
                                                                    .auth(consts.users.test_campaignlead.username, 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function() {
                                                                        frisby.create('check whether the notification of campaign promoted Offer has been deleted')
                                                                            .get(URL + '/notifications/' + activityNotification.id)
                                                                            .auth(consts.users.test_campaignlead.username, 'yp')
                                                                            .expectStatus(404)
                                                                            .after(function() {

                                                                                frisby.create('delete the created activityPlan')
                                                                                    .delete(URL + '/activityplans/' + newPlan.id)
                                                                                    .auth('test_sysadm', 'yp')
                                                                                    .expectStatus(200)
                                                                                    .after(function() {
                                                                                        return cleanupFn();
                                                                                    })
                                                                                    .toss();
                                                                            })
                                                                            .toss();
                                                                    })
                                                                    .toss();

                                                                frisby.create('Notification: delete public notifs as a product admin')
                                                                    .delete(URL + '/notifications/' + newPublicNotif.id + '?mode=administrate')
                                                                    .auth('test_prodadm', 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function () {
                                                                        frisby.create('check whether the YouPers Announcement has been deleted')
                                                                            .get(URL + '/notifications/' +  newPublicNotif.id)
                                                                            .auth('test_prodadm', 'yp')
                                                                            .expectStatus(404)
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


consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Notifications: post a campaignActivityPlan')
            .post(URL + '/activityplans', {
                "owner": consts.users.test_campaignlead.id,
                "idea": consts.groupIdea.id,
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
                frisby.create('Notifications: check notifications of user --> zero notifications becuase for campaign plans we do not implicitly generate Offers')
                    .get(URL + '/notifications')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (notifs) {
                        expect(notifs.length).toEqual(0);

                        frisby.create('Notifications: cleanup plan 1')
                            .delete(URL + '/activityplans/' + campaignPlan.id)
                            .auth('test_sysadm', 'yp')
                            .expectStatus(200)
                            .after(function () {
                                return cleanupFn();
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

        frisby.create('Notifications: post an activityPlan SUCCESS')
            .post(URL + '/activityplans', {
                "owner": user.id,
                "idea": consts.groupIdea.id,
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
                frisby.create('Notifications: check notifications of user after public group plan post --> EMPTY')
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

                                        frisby.create('Notifications: cleanup plan 2')
                                            .delete(URL + '/activityplans/' + myPlan.id)
                                            .auth('test_sysadm', 'yp')
                                            .expectStatus(200)
                                            .after(function () {

                                                frisby.create('Notifications: cleanup notif 2, should be cleaned automatically when plan is deleted')
                                                    .delete(URL + '/notifications/' + notifs[0].id)
                                                    .auth('test_sysadm', 'yp')
                                                    .expectStatus(404)
                                                    .after(function() {
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
                sourceType: 'youpers',
                publishFrom: moment().subtract(1, 'h'),
                publishTo: moment().add(1, 'h')
            })
            .auth('test_prodadm', 'yp')
            .expectStatus(201)
            .afterJSON(function (notif1) {
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
                        expect(_.map(notifs, 'id')).toContain(notif1.id);

                        frisby.create('Notifications: post outdated an Announcement to the Users Queue, ')
                            .post(URL + '/notifications', {
                                author: '52d4f515fac246174c000006',
                                title: "OUTDATED Message to : " + user.username,
                                targetQueue: user.id,
                                type: "message",
                                sourceType: 'youpers',
                                publishFrom: moment().subtract(2, 'h'),
                                publishTo: moment().subtract(1, 'h')
                            })
                            .auth('test_prodadm', 'yp')
                            .expectStatus(201)
                            .afterJSON(function (notif2) {
                                frisby.create('Notifications: check notifications of user --> outdated one not included')
                                    .get(URL + '/notifications')
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (notifs) {
                                        expect(_.map(notifs, 'id')).not.toContain(notif2.id);


                                        frisby.create('Notifications: post a future Announcement to the Users Queue, ')
                                            .post(URL + '/notifications', {
                                                author: '52d4f515fac246174c000006',
                                                title: "FUTURE MESSAGE to: " + user.username,
                                                targetQueue: user.id,
                                                type: "message",
                                                sourceType: 'youpers',
                                                publishFrom: moment().add(1, 'h'),
                                                publishTo: moment().add(2, 'h')
                                            })
                                            .auth('test_prodadm', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (notif3) {
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
                                                        expect(_.map(notifs, 'id')).not.toContain(notif3.id);


                                                        frisby.create("Notifications: cleanup")
                                                            .delete(URL + '/notifications/' + notif1.id)
                                                            .auth(user.username, 'yp')
                                                            .expectStatus(200).
                                                            after(function() {
                                                                frisby.create("Notifications: cleanup")
                                                                    .delete(URL + '/notifications/' + notif2.id)
                                                                    .auth(user.username, 'yp')
                                                                    .expectStatus(200)
                                                                    .after(function() {
                                                                        frisby.create("Notifications: cleanup")
                                                                            .delete(URL + '/notifications/' + notif3.id)
                                                                            .auth(user.username, 'yp')
                                                                            .expectStatus(200)
                                                                            .after(function() {
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
    });