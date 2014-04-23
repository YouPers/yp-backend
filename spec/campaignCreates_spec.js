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

frisby.create('Campaigns Creates: POST new campaign to existing organization')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_orgadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign1) {

        console.log ('new campaign id: ' + newCampaign1.id);

        frisby.create('Campaigns Creates: GET the created campaign')
            .get(URL + '/campaigns/' + newCampaign1.id)
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (reloadedCampaign1) {

                expect(reloadedCampaign1.title).toEqual(testCampaign.title);
                expect(reloadedCampaign1.campaignLeads).toBeDefined();
                expect(reloadedCampaign1.campaignLeads.length).toEqual(1);

                console.log ('campaign lead id: ' + reloadedCampaign1.campaignLeads[0]);

                frisby.create('Campaigns Creates: GET our testuser')
                    .get(URL + '/users/' + reloadedCampaign1.campaignLeads[0])
                    .auth('test_orgadm', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (user) {
                        expect(user.fullname).toEqual("Test OrgAdmin");

                        frisby.create('Campaigns Creates: DELETE the campaign 1: ' + reloadedCampaign1.id)
                            .auth('sysadm', 'backtothefuture')
                            .delete(URL+ '/campaigns/' + reloadedCampaign1.id)
                            .expectStatus(200)
                            .toss();

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

                        frisby.create('Campaigns Creates: POST new campaign to existing organization with wrong start/end dates')
                            .post(URL + '/campaigns', testCampaign)
                            .auth('test_orgadm', 'yp')
                            .expectStatus(409)
                            .toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();