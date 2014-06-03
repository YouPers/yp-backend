/**
 * Profile Routes module
 *    these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var paymentCodeHandlers = require('./../handlers/paymentcode_handlers'),
    mongoose = require('mongoose'),
    PaymentCode = mongoose.model('PaymentCode'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/paymentcodes';

    swagger.addPost({
        spec: {
            description: "Generates a payment code",
            path: baseUrl + '/generate',
            notes: "Generates a payment code",
            summary: "Generates a payment code",
            method: "POST",
            params: [swagger.bodyParam("values", "payment code values", "PaymentCode")],
            "responseClass": "PaymentCode",
            "errorResponses": [],
            "nickname": "generatePaymentCode",
            accessLevel: 'al_productadmin'
        },
        action: paymentCodeHandlers.generatePaymentCode()
    });
    swagger.addGet({
        spec: {
            description: "Get all payment codes",
            path: baseUrl,
            notes: "returns all payment codes",
            summary: "returns all payment codes",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Array[PaymentCode]",
            "nickname": "getPaymentCodes",
            accessLevel: 'al_productadmin'
        },
        action: generic.getAllFn(baseUrl, PaymentCode)
    });

    swagger.addPost({
        spec: {
            description: "Validate a payment code",
            path: baseUrl + '/validate',
            notes: "Validate a payment code",
            summary: "Validate a payment code",
            method: "POST",
            params: [swagger.bodyParam("value", "payment code", "String")],
            "responseClass": "String",
            "errorResponses": [],
            "nickname": "validatePaymentCode",
            accessLevel: 'al_orgadmin'
        },
        action: paymentCodeHandlers.validatePaymentCode()
    });
    swagger.addPost({
        spec: {
            description: "Redeem a payment code",
            path: baseUrl + '/redeem',
            notes: "Validate a payment code",
            summary: "Validate a payment code",
            method: "POST",
            params: [swagger.bodyParam("code", "payment code", "String")],
            "responseClass": "String",
            "errorResponses": [],
            "nickname": "redeemPaymentCode",
            accessLevel: 'al_orgadmin'
        },
        action: paymentCodeHandlers.redeemPaymentCode()
    });


};