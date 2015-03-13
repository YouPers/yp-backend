/**
 * Profile Routes module
 *    these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var paymentCodeHandlers = require('./../handlers/paymentcode_handlers'),
    mongoose = require('ypbackendlib').mongoose,
    PaymentCode = mongoose.model('PaymentCode'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    var baseUrl = '/paymentcodes';

    swagger.addOperation({
        spec: {
            description: "Validate a payment code",
            path: baseUrl + '/validate',
            notes: "Validate a payment code",
            summary: "Validate a payment code",
            method: "POST",
            params: [swagger.bodyParam("paymentCode", "payment code", "PaymentCode")],
            "responseClass": "string",
            "errorResponses": [],
            "nickname": "validatePaymentCode",
            accessLevel: 'al_user'
        },
        action: paymentCodeHandlers.validatePaymentCode()
    });


    swagger.addOperation({
        spec: {
            description: "Generates a payment code",
            path: baseUrl,
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
    swagger.addOperation({
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

    swagger.addOperation({
        spec: {
            description: "Deletes a payment codes",
            path: baseUrl + '/{id}',
            notes: "deletes a payment code",
            summary: "deletes a payment code",

            method: "DELETE",
            "nickname": "deletePaymentCode",
            accessLevel: 'al_productadmin'
        },
        action: generic.deleteByIdFn(baseUrl, PaymentCode)
    });

    swagger.addOperation({
        spec: {
            description: "Puts a payment codes",
            path: baseUrl + '/{id}',
            notes: "puts a payment code",
            summary: "puts a payment code",

            method: "PUT",
            "nickname": "putPaymentCode",
            accessLevel: 'al_productadmin'
        },
        action: generic.putFn(baseUrl, PaymentCode)
    });


    swagger.addOperation({
        spec: {
            description: "Redeem a payment code",
            path: baseUrl + '/redeem',
            notes: "Validate a payment code",
            summary: "Validate a payment code",
            method: "POST",
            params: [
                swagger.bodyParam("paymentCode", "payment code", "PaymentCode")
            ],
            "responseClass": "string",
            "errorResponses": [],
            "nickname": "redeemPaymentCodeFn",
            accessLevel: 'al_orgadmin'
        },
        action: paymentCodeHandlers.redeemPaymentCode()
    });


};