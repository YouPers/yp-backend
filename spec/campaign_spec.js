'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var campaignStart = moment({hour: 8, minute: 0, second: 0}).add('days',10);
var campaignEnd = moment({hour: 17, minute: 0, second: 0}).add('weeks',6).add('days',10);

console.log ('campaign start: ' + campaignStart.toString());
console.log ('campaign end: ' + campaignEnd.toString());

var testCampaign = {
    "title": "testOrganization's campaign 1 for work life balance",
    "start": campaignStart,
    "end": campaignEnd,
    "relatedService": "YP-Balance",
    "organization": "52f0c64e53d523235b07d8d8",
    "location": "Los Feliz",
    "slogan": "It's never too late!",
    "paymentStatus": "open",
    "productType": "CampaignProductType1"
};

frisby.create('Campaigns: POST new campaign to existing organization')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign) {

        console.log ('new campaign id: ' + newCampaign.id);

        frisby.create('Campaigns: GET the created campaign')
            .get(URL + '/campaigns/' + newCampaign.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (campaign) {

                expect(campaign.title).toEqual(testCampaign.title);
                expect(campaign.campaignLeads).toBeDefined();
                expect(campaign.campaignLeads.length).toEqual(1);

                console.log ('campaign lead id: ' + campaign.campaignLeads[0]);

                frisby.create('Campaigns: GET our testuser')
                    .get(URL + '/users/' + campaign.campaignLeads[0])
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (user) {
                        expect(user.fullname).toEqual("Test Individual 1");

                frisby.create('Campaigns: DELETE the campaign')
                    .auth('sysadm', 'backtothefuture')
                    .delete(URL+ '/campaigns/' + campaign.id)
                    .expectStatus(200)
                    .toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();

