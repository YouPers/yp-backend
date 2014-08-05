var mongoose = require('mongoose'),
    Model = mongoose.model('DiaryEntry'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/diaryentries',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about diaryEntries",
            path: baseUrlWithId,
            notes: "returns a diaryentry based on id",
            summary: "find diaryentry by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the diaryentry to be fetched", "string"),
                generic.params.populate],
            "responseClass": "DiaryEntry",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getDiaryEntryById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about diaryEntries",
            path: baseUrl,
            notes: "returns all diaryentries, but limits to 100 entries by default, is not owner-constrained, e.g. it returns diaryentries" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest diaryentries",
            summary: "get all diaryentries",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Array[DiaryEntry]",
            "nickname": "getDiaryentries",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addOperation({
            spec: {
                description: "Operations about diaryEntries",
                path: baseUrl,
                notes: "POSTs a new diaryentry",
                summary: "POSTs a new diaryentry",
                method: "POST",
                params: [swagger.bodyParam("DiaryEntry", "new DiaryEntry object", "DiaryEntry")],
                "responseClass": "DiaryEntry",
                "nickname": "postDiaryentries",
                accessLevel: 'al_individual'
            },
            action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about diaryEntries",
                path: baseUrlWithId,
                notes: "delete diaryentry",
                summary: "Deletes a diaryentry by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the diaryentry to be fetched", "string")],
                "nickname": "deleteDiaryEntry",
                accessLevel: 'al_user'
            },
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about diaryEntries",
                path: baseUrl,
                notes: "delete all diaryentries",
                summary: "Deletes diaryentries",
                method: "DELETE",
                "nickname": "deleteDiaryentries",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};