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
    "location": "Los Feliz",
    "slogan": "It's never too late!",
    "paymentStatus": "open",
    "productType": "CampaignProductType1"
};

var campaignId;

frisby.create('Campaigns Edits: POST new campaign to existing organization for later editing')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_orgadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign1) {

        console.log ('new campaign id: ' + newCampaign1.id);

        campaignId = newCampaign1.id;

        newCampaign1.campaignLeads.push("52a97f1650fca98c2900000b");
        newCampaign1.title = "new title for this campaign";

        frisby.create('Campaigns Edits: PUT a changed campaign title and an additional campaign lead to the previsously created campaign')
            .put(URL + '/campaigns/' + campaignId, newCampaign1)
            .auth('test_ind3', 'yp')
            .expectStatus(201)
            .afterJSON(function (reloadedCampaign1) {

                expect(reloadedCampaign1.title).toEqual("new title for this campaign");

                campaignStart = moment({hour: 8, minute: 0, second: 0}).add('days',10);
                campaignEnd = moment({hour: 17, minute: 0, second: 0}).add('weeks',27).add('days',10);

                testCampaign = {
                    "title": "testOrganization's campaign 2 for work life balance",
                    "start": campaignStart,
                    "end": campaignEnd,
                    "relatedService": "YP-Balance",
                    "location": "Los Feliz",
                    "slogan": "It's never too late!",
                    "productType": "CampaignProductType1"
                };

                frisby.create('Campaigns Edits: PUT changed campaign to existing organization with wrong start/end dates')
                    .put(URL + '/campaigns/' + campaignId, {"start": campaignStart, "end": campaignEnd})
                    .auth('test_orgadm', 'yp')
                    .expectStatus(409)
                    .toss();

                frisby.create('Campaigns Edits: PUT changed campaign to existing organization as campaign lead not listed as campaign lead on this campaign')
                    .put(URL + '/campaigns/' + campaignId, {"title": "new title for this campaign"})
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .toss();

                frisby.create('Campaigns Edits: PUT changed campaign to existing organization as individual user')
                    .put(URL + '/campaigns/' + campaignId, {"title": "new title for this campaign"})
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .toss();

                var testOrganization = {
                    name: 'testOrganization',
                    location: 'test address',
                    sector: 'test sector',
                    nrOfEmployees: '10',
                    avatar: 'assets/img/YouPersAvatar.png'
                };

                frisby.create('Campaigns Edits: POST new organization to get a 2nd org admin')
                    .post(URL + '/organizations', testOrganization)
                    .auth('test_ind1', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (newOrganization) {


                        frisby.create('Campaigns Edits: DELETE the campaign 1: ' + reloadedCampaign1.id)
                            .auth('sysadm', 'backtothefuture')
                            .delete(URL+ '/campaigns/' + campaignId)
                            .expectStatus(200)
                            .toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();
