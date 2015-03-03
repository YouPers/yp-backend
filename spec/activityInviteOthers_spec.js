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

// set the startDate in the future and ensure that it is a Wednesday
var startDate = moment().add(10, 'd').day(4).startOf('hour').toDate();
var endDate = moment(startDate).add(1, 'h').toDate();


consts.newUserInNewCampaignApi(function (err, user, campaign, cleanupFn) {

    var rnd = Math.floor((Math.random() * 10000) + 1);
    var username2 = 'testuser' + rnd;
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

            frisby.create('Event: inviteOthers')
                .post(URL + '/events', {
                    "owner": user.id,
                    "idea": consts.groupIdea.id,
                    "title": "myTitle",
                    "campaign": campaign.id,
                    "start": startDate,
                    "end": endDate,
                    "inviteOthers": true
                })
                .auth(user.username, 'yp')
                .expectStatus(201)
                .afterJSON(function (newPlan) {
                    expect(newPlan.joiningUsers).toMatchOrBeEmpty();
                    expect(newPlan.inviteOthers, true);


                    frisby.create('Event: get Event again and check whether correctly generated')
                        .get(URL + '/events/' + newPlan.id)
                        .auth(user.username, 'yp')
                        .expectStatus(200)
                        .afterJSON(function (reloadedEvent) {
                            expect(reloadedEvent.inviteOthers, true);


                            frisby.create('Event: get Invitations to see whether ind2 is invited')
                                .get(URL + '/invitations')
                                .auth(username2, 'yp')
                                .expectStatus(200)
                                .afterJSON(function (invitations) {
                                    expect(invitations.length).toEqual(1);
                                    expect(invitations[0].event).toEqual(reloadedEvent.id);

                                    newPlan.inviteOthers = false;

                                    frisby.create('Event: unset inviteOthers Flag and see whether its gone')
                                        .put(URL + '/events/' + newPlan.id, newPlan)
                                        .auth(user.username, 'yp')
                                        .expectStatus(200)
                                        .afterJSON(function (updatedPlan) {
                                            expect(updatedPlan.inviteOthers).toEqual(false);


                                            updatedPlan.inviteOthers = true;

                                            frisby.create('Event: set inviteOthers Flag again and see whether its there')
                                                .put(URL + '/events/' + newPlan.id, updatedPlan)
                                                .auth(user.username, 'yp')
                                                .expectStatus(200)
                                                .afterJSON(function (updatedPlan2) {
                                                    expect(updatedPlan2.inviteOthers).toEqual(true);

                                                    updatedPlan2.inviteOthers = true;

                                                    frisby.create('Event: unset inviteOthers Flag again and see whether its gone')
                                                        .put(URL + '/events/' + newPlan.id, updatedPlan2)
                                                        .auth(user.username, 'yp')
                                                        .expectStatus(200)
                                                        .afterJSON(function (updatedPlan3) {
                                                            expect(updatedPlan3.inviteOthers).toEqual(true);

                                                            frisby.create('Event: get Invitations to see whether ind2 is not invited anymore')
                                                                .get(URL + '/invitations')
                                                                .auth(username2, 'yp')
                                                                .expectStatus(200)
                                                                .afterJSON(function (invitations) {
                                                                    expect(invitations.length).toEqual(0);


                                                                    frisby.create('Event: delete the event again')
                                                                        .delete(URL + '/events/' + newPlan.id)
                                                                        .auth(user.username, 'yp')
                                                                        .expectStatus(200)
                                                                        .after(function () {


                                                                            frisby.create('Event: get Invitations to see whether ind2 is not invited anymore')
                                                                                .get(URL + '/invitations')
                                                                                .auth(username2, 'yp')
                                                                                .expectStatus(200)
                                                                                .afterJSON(function (invitations) {
                                                                                    expect(invitations.length).toEqual(0);
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
        })
        .toss();
});

