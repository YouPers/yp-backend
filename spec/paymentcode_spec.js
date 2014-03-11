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

var testValue = '123';

frisby.create('generatePaymentCode')
    .post(URL + '/paymentcode/generate', { value: testValue })
    .auth('test_prodadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (response) {

        var code = response.code;

        frisby.create('validatePaymentCode: Fail / Missing role orgadmin')
            .post(URL + '/paymentcode/validate', { code: code })
            .auth('test_ind3', 'yp')
            .expectStatus(403)
            .toss();


        frisby.create('validatePaymentCode: Weird: CODE + "test" does not fail')
            .post(URL + '/paymentcode/validate', { code: response.code + 'test'} )
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .toss();

        frisby.create('validatePaymentCode: Fail / Invalid Code')
            .post(URL + '/paymentcode/validate', { code: 'test' + response.code } )
            .auth('test_orgadm', 'yp')
            .expectStatus(409)
            .toss();

        frisby.create('validatePaymentCode: Success')
            .post(URL + '/paymentcode/validate', { code: code })
            .auth('test_orgadm', 'yp')
            .expectStatus(200)
            .afterJSON(function (response) {

                console.log('validatePaymentCode', code);
                console.log('validatePaymentCode', response.value);
                expect(response.value).toEqual(testValue);

            })
            .toss();



    })
    .toss();

