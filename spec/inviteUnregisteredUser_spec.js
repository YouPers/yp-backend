var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts'),
    moment = require('moment'),
    email = require('../src/util/email'),
    config = require('../src/config/config');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

// invite user to event by email, sign up with this user and have an invitation

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Invitation: plan an event first')
            .post(URL + '/events', {
                "owner": user.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "start": moment().add(1, 'days'),
                "end": moment().add(1, 'days').add(2, 'hours'),
                "allDay": false,
                "frequency": "once",
                "status": "active"
            })
            .auth(user.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (newPlan) {

                var rnd = Math.floor((Math.random() * 10000) + 1);
                var email = 'ypunittest1+coachTestUser' + rnd + '@gmail.com';
                console.log(email);

                frisby.create("Invitation: invite user by mail that is not yet signed up")
                    .post(URL + '/events/' + newPlan.id + "/inviteEmail", { email: email })
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .after(function () {


                        frisby.create('Invitation: POST new user')
                            .post(URL + '/users', {
                                username: 'new_unittest_user' + rnd,
                                fullname: 'Testing Unittest',
                                campaign: campaign.id,
                                firstname: 'Testing',
                                lastname: 'Unittest',
                                email: email,
                                password: 'yp',
                                roles: ['individual']
                            })
                            .expectStatus(201)
                            .afterJSON(function (testUser) {


                                frisby.create('Invitation: get invitations, will contain 1 invitation')
                                    .get(URL + '/invitations')
                                    .auth(testUser.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (invitations) {
                                        expect(invitations.length).toEqual(1);

                                        var invitation = invitations[0];

                                        expect(invitation.targetSpaces.length).toEqual(1);
                                        expect(invitation.targetSpaces[0].type).toEqual('user');
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
