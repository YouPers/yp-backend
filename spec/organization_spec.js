'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA=='
        },
        json:true
    }
});

var testOrganization = {
    name: 'testOrganization',
    address: 'test address',
    sector: 'test sector',
    nrOfEmployees: '10',
    avatar: 'assets/img/YouPersAvatar.png'
};

frisby.create('POST new organization')
    .post(URL + '/organizations', testOrganization)
    .expectStatus(201)
    .afterJSON(function (newOrganization) {

        frisby.create('GET just our testuser')
            .get(URL + '/organizations/' + newOrganization.id)
            .expectStatus(200)
            .afterJSON(function (organization) {

                expect(organization.name).toEqual(testOrganization.name);
                expect(organization.administrators).toBeDefined();
                expect(organization.administrators.length).toEqual(1);

                frisby.create('DELETE our testuser')
                    .auth('sysadm', 'backtothefuture')
                    .delete(URL+ '/organizations/' + organization.id)
                    .expectStatus(200)
                    .toss();

            })
            .toss();

    })
    .toss();

