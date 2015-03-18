'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

var campaignStart = moment({hour: 8, minute: 0, second: 0}).add(10, 'days').toDate();
var campaignEnd = moment({hour: 17, minute: 0, second: 0}).add(6, 'weeks').add(10, 'days').toDate();

var testCampaign = {
    "title": "testOrganization's campaign 1 for work life balance",
    "start": campaignStart,
    "end": campaignEnd,
    "topic": "53b416cfa43aac62a2debda1",
    "location": "Los Feliz",
    "slogan": "It's never too late!",
    "paymentStatus": "open",
    "productType": "CampaignProductType1"
};

frisby.create('Campaigns Creates: POST new campaign to existing organization')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_orgadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign1) {

        frisby.create('Campaigns Creates: GET the created campaign')
            .get(URL + '/campaigns/' + newCampaign1.id)
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (reloadedCampaign1) {

                expect(reloadedCampaign1.title).toEqual(testCampaign.title);
                expect(reloadedCampaign1.campaignLeads).toBeDefined();
                expect(reloadedCampaign1.campaignLeads.length).toEqual(1);

                frisby.create('Campaigns Creates: GET our testuser')
                    .get(URL + '/users/' + reloadedCampaign1.campaignLeads[0])
                    .auth('test_orgadm', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (user) {
                        expect(user.fullname).toEqual("Test OrgAdmin");

                        frisby.create('Campaigns Creates: DELETE the campaign 1: ' + reloadedCampaign1.id)
                            .delete(URL+ '/campaigns/' + reloadedCampaign1.id)
                            .auth('sysadm', 'backtothefuture')
                            .expectStatus(200)
                            .toss();


                    })
                    .toss();

            })
            .toss();

    })
    .toss();