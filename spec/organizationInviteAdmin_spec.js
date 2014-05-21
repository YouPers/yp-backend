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

var testOrg = {
    "name": "testOrganization",
    "location": "testLocation"
};

var test_ind2Id = '52a97f1650fca98c29000007';

frisby.create('OrganizationInviteAdmin: POST new org')
    .post(URL + '/organizations', testOrg)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newOrg) {

        frisby.create('OrganizationInviteAdmin: GET the created org')
            .get(URL + '/organizations/' + newOrg.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (org) {

                expect(org.name).toEqual(testOrg.name);
                expect(org.administrators).toBeDefined();
                expect(org.administrators.length).toEqual(1);

                frisby.create('OrganizationInviteAdmin: invite a user without being an orgadmin FAIL')
                    .post(URL + '/organizations/' + newOrg.id + '/inviteOrganizationAdminEmail', {email: "ypunittest1+individual2@gmail.com"})
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .toss();


                frisby.create('OrganizationInviteAdmin: invite a new user')
                    .post(URL + '/organizations/' + newOrg.id + '/inviteOrganizationAdminEmail', {email: "ypunittest1+mynewuser@gmail.com"})
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

                frisby.create('OrganizationInviteAdmin: invite the existing user test_ind2')
                    .post(URL + '/organizations/' + newOrg.id + '/inviteOrganizationAdminEmail', {email: "ypunittest1+individual2@gmail.com"})
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .after(function () {
                        // we need to create the token ourselves, because we cannot get the email in this test
                        var token = email.encryptLinkToken(newOrg.id +
                            email.linkTokenSeparator +
                            'ypunittest1+individual2@gmail.com' +
                            email.linkTokenSeparator +
                            test_ind2Id
                        );

                        frisby.create('OrganizationInviteAdmin: submit the assign new org Lead without token FAIL')
                            .post(URL + '/organizations/' + newOrg.id + '/assignOrganizationAdmin')
                            .auth('test_ind2', 'yp')
                            .expectStatus(409)
                            .after(function () {

                                frisby.create('OrganizationInviteAdmin: submit the assign new org Lead with invalid token')
                                    .post(URL + '/organizations/' + newOrg.id + '/assignOrganizationAdmin?token=MYHACKTOKEN')
                                    .auth('test_ind2', 'yp')
                                    .expectStatus(409)
                                    .after(function () {

                                        frisby.create('OrganizationInviteAdmin: submit the assign new org Lead')
                                            .post(URL + '/organizations/' + newOrg.id + '/assignOrganizationAdmin?token=' + token)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (org) {
                                                expect(org.administrators.length).toEqual(2);
                                                expect(org.administrators).toContain(test_ind2Id);


                                                frisby.create('OrganizationInviteAdmin: submit the assign new org Lead again, check whether idempoptent')
                                                    .post(URL + '/organizations/' + newOrg.id + '/assignOrganizationAdmin?token=' + token)
                                                    .auth('test_ind2', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (org) {
                                                        expect(org.administrators.length).toEqual(2);
                                                        expect(org.administrators).toContain(test_ind2Id);

                                                        frisby.create('OrganizationInviteAdmin: DELETE the org')
                                                            .delete(URL + '/organizations/' + newOrg.id)
                                                            .auth('sysadm', 'backtothefuture')
                                                            .expectStatus(200)
                                                            .toss();

                                                        frisby.create('OrganizationInviteAdmin: reset roles of individual2')
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

