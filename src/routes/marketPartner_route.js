/**
 * these routes require authenticated users
 * Created by irig on 13.01.14.
 */

var mongoose = require('ypbackendlib').mongoose,
    MarketPartner = mongoose.model('MarketPartner'),
    generic = require('ypbackendlib').handlers;

module.exports = function (swagger) {

    var baseUrl = '/marketpartners';
    var baseUrlWithId = baseUrl + '/{id}';


    swagger.addOperation({
        spec: {
            description: "Get all marketPartner",
            path: baseUrl,
            notes: "returns all marketPartner",
            summary: "returns all marketPartner",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Array[MarketPartner]",
            "nickname": "getMarketPartners",
            accessLevel: 'al_productadmin'
        },
        action: generic.getAllFn(baseUrl, MarketPartner)
    });

    swagger.addOperation({
        spec: {
            description: "Get one marketPartner",
            path: baseUrlWithId,
            notes: "returns one marketPartner",
            summary: "returns one marketPartner",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "MarketPartner",
            "nickname": "getMarketPartner",
            accessLevel: 'al_productadmin'
        },
        action: generic.getByIdFn(baseUrlWithId, MarketPartner)
    });


    swagger.addOperation({
        spec: {
            description: "POST a marketPartner",
            path: baseUrl,
            notes: "post a new marketPartner",
            summary: "returns one marketPartner",
            method: "POST",
            "responseClass": "MarketPartner",
            "nickname": "postMarketPartners",
            accessLevel: 'al_productadmin'
        },
        action: generic.postFn(baseUrlWithId, MarketPartner)
    });

    swagger.addOperation({
        spec: {
            description: "PUT a marketPartner",
            path: baseUrlWithId,
            notes: "update an existing marketPartner",
            summary: "returns one marketPartner",
            method: "PUT",
            "responseClass": "MarketPartner",
            "nickname": "putMarketPartners",
            accessLevel: 'al_productadmin'
        },
        action: generic.putFn(baseUrlWithId, MarketPartner)
    });

    swagger.addOperation({
        spec: {
            description: "DELETE a marketPartner",
            path: baseUrlWithId,
            notes: "update an existing marketPartner",
            summary: "returns one marketPartner",
            method: "DELETE",
            "responseClass": "MarketPartner",
            "nickname": "deleteMarketPartners",
            accessLevel: 'al_productadmin'
        },
        action: generic.deleteByIdFn(baseUrlWithId, MarketPartner)
    });
}