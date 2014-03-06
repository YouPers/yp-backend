/**
 * Profile Routes module
 *    these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var paymentCodeHandlers = require('./../handlers/paymentcode_handlers');

module.exports = function (swagger, config) {

    swagger.addPost({
        spec: {
            description: "Generates a payment code",
            path: '/paymentcode/generate',
            notes: "Generates a payment code",
            summary: "Generates a payment code",
            method: "POST",
            params: [swagger.bodyParam("values", "payment code values", "Object")],
            "responseClass": "String",
            "errorResponses": [],
            "nickname": "generatePaymentCode",
            accessLevel: 'al_productadmin'
        },
        action: paymentCodeHandlers.generatePaymentCode()
    });
    swagger.addPost({
        spec: {
            description: "Validate a payment code",
            path: '/paymentcode/validate',
            notes: "Validate a payment code",
            summary: "Validate a payment code",
            method: "POST",
            params: [swagger.bodyParam("value", "payment code value", "String")],
            "responseClass": "String",
            "errorResponses": [],
            "nickname": "validatePaymentCode",
            accessLevel: 'al_orgadmin'
        },
        action: paymentCodeHandlers.validatePaymentCode()
    });


};