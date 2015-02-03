var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});


consts.newUserInNewCampaignApi(function (err, user, campaign, cleanupFn) {
    var rnd = Math.floor((Math.random() * 10000) + 1);
    var username2 = 'testuser2' + rnd;
    frisby.create('ActivityInvite: POST 2nd new user')
        .post(URL + '/users', {
            username: username2,
            fullname: 'Testing Unittest',
            campaign: campaign.id,
            firstname: 'Testing',
            lastname: 'Unittest',
            email: 'ypunittest1+coachTestUser' + rnd + '@gmail.com',
            password: 'yp',
            roles: ['individual']
        })
        .expectStatus(201)
        .afterJSON(function (testUser2) {

            frisby.create('ActivityInvite: post event to test "invite" query param')
                .post(URL + '/events?invite=' + testUser2.id, {
                    "owner": user.id,
                    "idea": consts.groupIdea.id,
                    "visibility": "public",
                    "title": "myTitle",
                    "campaign": campaign.id,
                    "executionType": "group",
                    "start": moment().add(1, 'w').day(2).add(1, 'hours').toDate(),
                    "end": moment().add(1, 'w').day(2).add(2, 'hours').toDate(),
                    "allDay": false,
                    "frequency": "once",
                    "status": "active"
                })
                .auth(user.username, 'yp')
                .expectStatus(201)
                .afterJSON(function (newPlan) {

                    frisby.create('ActivityInvite: get Invitations to see whether testuser2 is invited')
                        .get(URL + '/invitations')
                        .auth(username2, 'yp')
                        .expectStatus(200)
                        .afterJSON(function (invitations) {
                            expect(invitations.length).toEqual(1);
                            expect(invitations[0].event).toEqual(newPlan.id);

                            frisby.create('ActivityInvite: delete event')
                                .delete(URL + '/events/' + newPlan.id)
                                .auth(user.username, 'yp')
                                .expectStatus(200)
                                .after(function () {
                                    cleanupFn();
                                })
                                .toss();

                            frisby.create('ActivityInvite: delete user 2')
                                .delete(URL + '/users/' + testUser2.id)
                                .auth('test_sysadm', 'yp')
                                .expectStatus(200)
                                .toss();
                        })
                        .toss();
                })
                .toss();
        })
        .toss();
});