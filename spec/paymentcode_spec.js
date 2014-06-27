'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

var testCampaign = '527916a82079aa8704000007';
var testProductCode = {
    relatedService: 'YP-Balance',
    productType: 'CampaignProductType1',
    users: '1',

    campaign: testCampaign
};

frisby.create('generatePaymentCode')
    .post(URL + '/paymentcodes/generate', testProductCode)
    .auth('test_prodadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (response) {

        var code = response.code;

        frisby.create('validatePaymentCode: Fail / Missing role orgadmin')
            .post(URL + '/paymentcodes/validate', { code: code })
            .auth('test_ind2', 'yp')
            .expectStatus(403)
            .toss();


        frisby.create('validatePaymentCode: Fail / Invalid Code')
            .post(URL + '/paymentcodes/validate', { code: 'test' + code } )
            .auth('test_orgadm', 'yp')
            .expectStatus(404)
            .toss();

        frisby.create('validatePaymentCode: Success')
            .post(URL + '/paymentcodes/validate', { code: code })
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (response) {
//                expect(response.value).toEqual(testValue);



                frisby.create('redeemPaymentCode: Success')
                    .post(URL + '/paymentcodes/redeem', { code: code, campaign: testCampaign })
                    .auth('test_orgadm', 'yp')
                    .expectStatus(201)
                    .afterJSON(function (response) {

                        frisby.create('redeemPaymentCode: revert campaign.paymentStatus = paid')
                            .put(URL + '/campaigns/' + testCampaign, {"paymentStatus": "open"})
                            .auth('test_orgadm', 'yp')
                            .expectStatus(200)
                            .toss();

                    })
                    .toss();

            })
            .toss();



    })
    .toss();

