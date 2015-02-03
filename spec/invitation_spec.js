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
        headers: {}
    }
});

// invite user to an activity plan, invitation is dismissed by joining the plan

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Invitation: plan an activity first')
            .post(URL + '/activities', {
                "owner": consts.users.test_ind1.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "start": moment().add(1, 'days').toDate(),
                "end": moment().add(1, 'days').add(2, 'hours').toDate(),
                "allDay": false,
                "frequency": "once",
                "status": "active"
            }, {json: true})
            .auth('test_ind1', 'yp')
            .expectStatus(201)
            .afterJSON(function (newPlan) {

                frisby.create("Invitation: invite user to this activity")
                    .post(URL + '/activities/' + newPlan.id + "/inviteEmail", { email: user.email })
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('Invitation: get invitations, will contain 1 invitation')
                            .get(URL + '/invitations')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (invitations) {
                                expect(invitations.length).toEqual(1);

                                var invitation = invitations[0];

                                expect(invitation.idea).toBeDefined();
                                expect(invitation.refDocs.length).toEqual(0);
                                expect(invitation.activity).toBeDefined();
                                expect(invitation.activity).toEqual(newPlan.id);


                                frisby.create('Invitation: get this single invitation populated with the activity')
                                    .get(URL + '/invitations/' + invitation.id + "?populate=activity")
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (invitation) {

                                        expect(invitation.refDocs.length).toEqual(0);
                                        expect(invitation.activity.id).toEqual(newPlan.id);

                                    })
                                    .toss();

                                frisby.create('Invitation: join the activity, will dismiss the invitation')
                                    .post(URL + '/activities/' + newPlan.id + '/join')
                                    .auth(user.username, 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (joinedPlan) {

                                        frisby.create('Invitation: get lookahead counters, should contain 1 new joining user')
                                            .get(URL + '/activities/' + joinedPlan.id + '/lookAheadCounters')
                                            .auth('test_ind1', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (result) {
                                                expect(result.joiningUsers).toEqual(1);

                                                frisby.create('Invitation: get lookahead counters with timestamp, should contain no new joining user')
                                                    .get(URL + '/activities/' + joinedPlan.id + '/lookAheadCounters' + '?since=' + moment().toISOString())
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (result) {
                                                        expect(result.joiningUsers).toEqual(0);
                                                    })
                                                    .toss();
                                            })
                                            .toss();

                                        frisby.create('Invitation: get inbox, will be empty again')
                                            .get(URL + '/socialInteractions')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);

                                                frisby.create('Invitation: get inbox, including dismissed')
                                                    .get(URL + '/socialInteractions?dismissed=true&dismissalReason=activityJoined')
                                                    .auth(user.username, 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (socialInteractions) {


                                                        // Invitations for activities the user already participates are NOT returned anymore
                                                        // see WL-1218
                                                        expect(socialInteractions.length).toEqual(0);



//                                                        expect(socialInteractions[0].dismissed).toBeTruthy();
//                                                        expect(socialInteractions[0].dismissalReason).toEqual('activityJoined');

                                                        frisby.create("Invitation: delete the activity")
                                                            .delete(URL + '/activities/' + newPlan.id)
                                                            .auth('test_ind1', 'yp')
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
                    })
                    .toss();
            })
            .toss();
    });


// invite user to an activity, invitation is dismissed when the activity is deleted

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Invitation: plan an activity first')
            .post(URL + '/activities', {
                "owner": consts.users.test_ind1.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "start": moment().add(1, 'days').toDate(),
                "end": moment().add(1, 'days').add(2, 'hours').toDate(),
                "allDay": false,
                "frequency": "once",
                "status": "active"
            })
            .auth('test_ind1', 'yp')
            .expectStatus(201)
            .afterJSON(function (newActivity) {

                frisby.create("Invitation: invite user to this activity")
                    .post(URL + '/activities/' + newActivity.id + "/inviteEmail", { email: user.email })
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .after(function () {

                        frisby.create('Invitation: get invitations, will contain 1 invitation')
                            .get(URL + '/invitations')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (invitations) {
                                expect(invitations.length).toEqual(1);

                                var invitation = invitations[0];

                                expect(invitation.refDocs.length).toEqual(0);
                                expect(invitation.activity).toEqual(newActivity.id);

                                frisby.create('Invitation: delete the activity, will dismiss the invitation')
                                    .delete(URL + '/activities/' + newActivity.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .after(function () {

                                        frisby.create('Invitation: get inbox, will be empty again')
                                            .get(URL + '/socialInteractions')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);
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
    });


// invite user to be campaign lead

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create("Invitation: invite user to be campaign lead")
            .post(URL + '/campaigns/' + campaign.id + "/inviteCampaignLeadEmail", { email: user.email })
            .auth(consts.users.test_orgadm.username, 'yp')
            .expectStatus(200)
            .after(function () {

                frisby.create('Invitation: get invitations, will contain 1 invitation')
                    .get(URL + '/invitations')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (invitations) {
                        expect(invitations.length).toEqual(1);

                        var invitation = invitations[0];

                        expect(invitation.refDocs.length).toEqual(1);
                        expect(invitation.refDocs[0].model).toEqual('Campaign');
                        expect(invitation.refDocs[0].docId).toEqual(campaign.id);

                        // we need to create the token ourselves, because we cannot get the email in this test
                        var token = email.encryptLinkToken(campaign.id +
                                config.linkTokenEncryption.separator +
                                user.email +
                                config.linkTokenEncryption.separator +
                                user.id
                        );

                        frisby.create('Invitation: accept invitation for campaign lead')
                            .post(URL + '/campaigns/' + campaign.id + '/assignCampaignLead?token=' + token)
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (campaign) {
                                expect(campaign.campaignLeads.length).toEqual(2);
                                expect(campaign.campaignLeads).toContain(user.id);

                                frisby.create('Invitation: get inbox, will be empty again')
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

    });
// invite user to be organization admin

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create("Invitation: invite user to be organization admin")
            .post(URL + '/organizations/' + consts.organization.id + "/inviteOrganizationAdminEmail", { email: user.email })
            .auth(consts.users.test_orgadm.username, 'yp')
            .expectStatus(200)
            .after(function () {

                frisby.create('Invitation: get invitations, will contain 1 invitation')
                    .get(URL + '/invitations')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (invitations) {
                        expect(invitations.length).toEqual(1);

                        var invitation = invitations[0];

                        expect(invitation.refDocs.length).toEqual(1);
                        expect(invitation.refDocs[0].model).toEqual('Organization');
                        expect(invitation.refDocs[0].docId).toEqual(consts.organization.id);


                        // we need to create the token ourselves, because we cannot get the email in this test
                        var token = email.encryptLinkToken(consts.organization.id +
                                config.linkTokenEncryption.separator +
                                user.email +
                                config.linkTokenEncryption.separator +
                                user.id
                        );

                        frisby.create('Invitation: submit the assign new org Lead')
                            .post(URL + '/organizations/' + consts.organization.id + '/assignOrganizationAdmin?token=' + token)
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (org) {
                                expect(org.administrators.length).toEqual(2);
                                expect(org.administrators).toContain(user.id);

                                delete org.__v;

                                _.remove(org.administrators, function (admin) {
                                    return admin === user.id;
                                });

                                frisby.create('Invitation: remove the new admin again')
                                    .put(URL + '/organizations/' + consts.organization.id, org)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (savedOrg) {

                                        expect(savedOrg.administrators.length).toEqual(1);

                                        frisby.create('Invitation: get inbox, will be empty again')
                                            .get(URL + '/socialInteractions')
                                            .auth(user.username, 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (socialInteractions) {
                                                expect(socialInteractions.length).toEqual(0);
                                                cleanupFn();
                                            })
                                            .toss();

                                    }).toss();

                            })
                            .toss();
                    })
                    .toss();
            })
            .toss();
    });