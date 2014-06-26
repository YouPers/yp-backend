var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts'),
    moment = require('moment'),
    email = require('../src/util/email');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

// invite user to an activity plan

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('Invitation: plan an activity first')
            .post(URL + '/activityplans', {
                "owner": consts.users.test_ind1.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "mainEvent": {
                    "start": moment().add('days', 1),
                    "end": moment().add('days', 1).add('hours', 2),
                    "allDay": false,
                    "frequency": "once"
                },
                "status": "active"
            })
            .auth('test_ind1', 'yp')
            .expectStatus(201)
            .afterJSON(function (newPlan) {

                frisby.create("Invitation: invite user to this plan")
                    .post(URL + '/activityplans/' + newPlan.id + "/inviteEmail", { email: user.email })
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

                                expect(invitation.refDocs.length).toEqual(1);
                                expect(invitation.refDocs[0].model).toEqual('ActivityPlan');
                                expect(invitation.refDocs[0].docId).toEqual(newPlan.id);

                                frisby.create('Invitation: join the plan, will dismiss the invitation')
                                    .post(URL + '/activityplans/' + newPlan.id + '/join')
                                    .auth(user.username, 'yp')
                                    .expectStatus(201)
                                    .afterJSON(function (joinedPlan) {

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
                            email.linkTokenSeparator +
                            user.email +
                            email.linkTokenSeparator +
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
                            email.linkTokenSeparator +
                            user.email +
                            email.linkTokenSeparator +
                            user.id
                        );

                        frisby.create('OrganizationInviteAdmin: submit the assign new org Lead')
                            .post(URL + '/organizations/' + consts.organization.id + '/assignOrganizationAdmin?token=' + token)
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (org) {
                                expect(org.administrators.length).toEqual(2);
                                expect(org.administrators).toContain(user.id);

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