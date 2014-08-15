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

var campaignStart = moment({hour: 8, minute: 0, second: 0}).add(10, 'days');
var campaignEnd = moment({hour: 17, minute: 0, second: 0}).add(6, 'weeks').add(10, 'days');

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

frisby.create('Campaigns Get: POST new campaign to existing organization')
    .post(URL + '/campaigns', testCampaign)
    .auth('test_orgadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newCampaign1) {
        frisby.create('Campaigns Get: GET the created campaign as Orgadm, check if protected Attrs are loaded')
            .get(URL + '/campaigns/' + newCampaign1.id)
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .expectJSONTypes({
                paymentStatus: String,
                productType: String
            })
            .after(function() {


                frisby.create('Campaigns Get: GET the created campaign as anonymous, check if protected Attrs are  NOT loaded')
                    .get(URL + '/campaigns/' + newCampaign1.id)
                    .expectStatus(200)
                    .afterJSON(function(campaign) {
                        expect(campaign.paymentStatus).toBeUndefined();
                        expect(campaign.productType).toBeUndefined();
                    })
                    .after(function() {

                        frisby.create('Campaigns Get: GET the created campaign as anonymous, check if protected Attrs are  NOT loaded')
                            .get(URL + '/campaigns/' + newCampaign1.id)
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .afterJSON(function(campaign) {
                                expect(campaign.paymentStatus).toBeUndefined();
                                expect(campaign.productType).toBeUndefined();

                                frisby.create('delete the created campaign')
                                    .delete(URL + '/campaigns/' + newCampaign1.id)
                                    .auth('test_sysadm', 'yp')
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