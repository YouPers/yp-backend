'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var testOrganization = {
    name: 'testOrganization',
    address: 'test address',
    sector: 'test sector',
    nrOfEmployees: '10',
    avatar: 'assets/img/YouPersAvatar.png'
};

frisby.create('organization: POST new organization')
    .post(URL + '/organizations', testOrganization)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newOrganization) {

        frisby.create('organization: GET just our test organization')
            .get(URL + '/organizations/' + newOrganization.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (organization) {

                expect(organization.name).toEqual(testOrganization.name);
                expect(organization.administrators).toBeDefined();
                expect(organization.administrators.length).toEqual(1);

//                frisby.create('organization: DELETE our test organization')
//                    .auth('sysadm', 'backtothefuture')
//                    .delete(URL+ '/organizations/' + organization.id)
//                    .expectStatus(200)
//                    .toss();

            })
            .toss();

    })
    .toss();

