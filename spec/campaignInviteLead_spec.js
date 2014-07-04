'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var moment = require('moment');
var email = require('../src/util/email');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

var campaignStart = moment({hour: 8, minute: 0, second: 0}).add('days', 10);
var campaignEnd = moment({hour: 17, minute: 0, second: 0}).add('weeks', 6).add('days', 10);

var testCampaign = {
    "title": "testOrganization's campaign 1 for work life balance",
    "start": campaignStart,
    "end": campaignEnd,
    "topic": "53b416cfa43aac62a2debda1",
    "organization": "52f0c64e53d523235b07d8d8",
    "location": "Los Feliz",
    "slogan": "It's never too late!",
    "paymentStatus": "open",
    "productType": "CampaignProductType1"
};

var test_ind2Id = '52a97f1650fca98c29000007';

frisby.create('CampaignsInviteLead: POST new campaign to existing organization')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_orgadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign) {

        frisby.create('CampaignsInviteLead: GET the created campaign')
            .get(URL + '/campaigns/' + newCampaign.id)
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (campaign) {

                expect(campaign.title).toEqual(testCampaign.title);
                expect(campaign.campaignLeads).toBeDefined();
                expect(campaign.campaignLeads.length).toEqual(1);

                frisby.create('CampaignsInviteLead: invite a user without being an orgadmin FAIL')
                    .post(URL + '/campaigns/' + newCampaign.id + '/inviteCampaignLeadEmail', {email: "ypunittest1+individual2@gmail.com"})
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .toss();

                frisby.create('CampaignsInviteLead: invite a user as a campaignlead of another campaign FAIL')
                    .post(URL + '/campaigns/' + newCampaign.id + '/inviteCampaignLeadEmail', {email: "ypunittest1+individual2@gmail.com"})
                    .auth('test_campaignlead', 'yp')
                    .expectStatus(403)
                    .toss();

                frisby.create('CampaignsInviteLead: invite a new user')
                    .post(URL + '/campaigns/' + newCampaign.id + '/inviteCampaignLeadEmail', {email: "ypunittest1+mynewuser@gmail.com"})
                    .auth('test_orgadm', 'yp')
                    .expectStatus(200)
                    .toss();

                frisby.create('CampaignsInviteLead: invite the existing user test_ind2')
                    .post(URL + '/campaigns/' + newCampaign.id + '/inviteCampaignLeadEmail', {email: "ypunittest1+individual2@gmail.com"})
                    .auth('test_orgadm', 'yp')
                    .expectStatus(200)
                    .after(function () {
                        // we need to create the token ourselves, because we cannot get the email in this test
                        var token = email.encryptLinkToken(newCampaign.id +
                            email.linkTokenSeparator +
                            'ypunittest1+individual2@gmail.com' +
                            email.linkTokenSeparator +
                            test_ind2Id
                        );

                        frisby.create('CampaignsInviteLead: submit the assign new campaign Lead without token FAIL')
                            .post(URL + '/campaigns/' + newCampaign.id + '/assignCampaignLead')
                            .auth('test_ind2', 'yp')
                            .expectStatus(409)
                            .after(function () {

                                frisby.create('CampaignsInviteLead: submit the assign new campaign Lead with invalid token')
                                    .post(URL + '/campaigns/' + newCampaign.id + '/assignCampaignLead?token=MYHACKTOKEN')
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(409)
                                    .after(function () {

                                        frisby.create('CampaignsInviteLead: submit the assign new campaign Lead')
                                            .post(URL + '/campaigns/' + newCampaign.id + '/assignCampaignLead?token=' + token)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (campaign) {
                                                expect(campaign.campaignLeads.length).toEqual(2);
                                                expect(campaign.campaignLeads).toContain(test_ind2Id);


                                                frisby.create('CampaignsInviteLead: submit the assign new campaign Lead again, check whether idempoptent')
                                                    .post(URL + '/campaigns/' + newCampaign.id + '/assignCampaignLead?token=' + token)
                                                    .auth('test_ind2', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (campaign) {
                                                        expect(campaign.campaignLeads.length).toEqual(2);
                                                        expect(campaign.campaignLeads).toContain(test_ind2Id);

                                                        frisby.create('CampaignsInviteLead: DELETE the campaign')
                                                            .delete(URL + '/campaigns/' + newCampaign.id)
                                                            .auth('sysadm', 'backtothefuture')
                                                            .expectStatus(200)
                                                            .toss();

                                                        frisby.create('CampaignsInviteLead: reset roles of individual2')
                                                            .put(URL + '/users/' + test_ind2Id, {roles: 'individual'})
                                                            .auth('sysadm', 'backtothefuture')
                                                            .expectStatus(200)
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

