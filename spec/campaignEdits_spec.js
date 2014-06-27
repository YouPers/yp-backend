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

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        var campaignId = campaign.id;

        console.log ('new campaign id: ' + campaign.id);

        campaignId = campaign.id;

        campaign.campaignLeads.push("52a97f1650fca98c2900000b");
        campaign.title = "new title for this campaign";

        frisby.create('Campaigns Edits: PUT a changed campaign title and an additional campaign lead to the previsously created campaign')
            .put(URL + '/campaigns/' + campaignId, campaign)
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (reloadedCampaign1) {

                expect(reloadedCampaign1.title).toEqual("new title for this campaign");

                campaignStart = moment({hour: 8, minute: 0, second: 0}).add('days',10);
                campaignEnd = moment({hour: 17, minute: 0, second: 0}).add('weeks',27).add('days',10);



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
                    .afterJSON(function(org) {
                        frisby.create('Campaigns Edits: Delete the org again')
                            .delete(URL + '/organizations/' + org.id)
                            .auth('test_sysadm', 'yp')
                            .expectStatus(200)
                            .toss();

                        return cleanupFn();
                    })
                    .toss();

            })
            .toss();

    });

