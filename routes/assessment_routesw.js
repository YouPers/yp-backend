/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Assessment = mongoose.model('Assessment'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    generic = require('../handlers/generic'),
    handlers = require('../handlers/assessment_handlers.js');


module.exports = function (swagger, config) {

    var baseUrl = '/assessments',
        baseUrlWithId = baseUrl + "/{id}";
    var resultsUrl = baseUrl + '/{assId}/results';

    swagger.addPost({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: resultsUrl,
            notes: "stores a new result",
            summary: "stores a new result for the assessment with id assId",
            method: "POST",
            params: [swagger.pathParam("assId", "ID of the assessment for which to store a result", "string"),
                swagger.bodyParam("assessmentResult", "The assessment result to store", "AssessmentResult")],
            "responseMessages": [
                {
                    "code": 201,
                    "message": "Created",
                    "responseModel": "AssessmentResult"
                },
                {
                    "code": 401,
                    "message": "Unauthorized: client or user not authorized to call this method"
                },
                {
                    "code": 204,
                    "message": "assessment with this id not found"
                }
            ],
            "nickname": "postAssessmentResult",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: generic.postFn(resultsUrl, AssessmentResult)
    });

    swagger.addGet({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl + '/newest',
                notes: "always returns zero or one result, the newest result is the one with the newest timestamp",
                summary: "returns a the newest assessmentResult for the current user and the assessment with id assId",
                method: "GET",
                params: [swagger.pathParam("assId", "ID of the assessment for which to store a result", "string"),
                    generic.params.populate,
                    generic.params.populatedeep],
                "responseClass": "AssessmentResult",
                "errorResponses": [swagger.errors.invalid('assId'), swagger.errors.notFound("assessment")],
                "nickname": "getNewestAssessmentResult",
                accessLevel: 'al_individual',
                beforeCallbacks: []
            },
            action: handlers.getNewestResult(resultsUrl, AssessmentResult)
        }
    );

    swagger.addGet({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl,
                notes: "returns an array of assessmentResults",
                summary: "returns all assessmentResult for the current user and the assessment with id assId",
                method: "GET",
                params: [swagger.pathParam("assId", "ID of the assessment for which to store a result", "string")],
                "responseClass": "AssessmentResult",
                "errorResponses": [swagger.errors.invalid('assId'), swagger.errors.notFound("assessment")],
                "nickname": "getAssessmentResults",
                accessLevel: 'al_individual',
                beforeCallbacks: []
            },
            action: generic.getAllFn(resultsUrl, AssessmentResult)
        }
    );

    swagger.addDelete({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl,
                notes: "can only delete the results for one specific assessement",
                summary: "deletes all assessmentResults for the current user and the assessment with id assId",
                method: "DELETE",
                params: [swagger.pathParam("assId", "ID of the assessment for which to store a result", "string")],
                "nickname": "deleteAssessmentResults",
                accessLevel: 'al_user',
                beforeCallbacks: []
            },
            action: generic.deleteAllFn(resultsUrl, AssessmentResult)
        }
    );

    swagger.addDelete({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl + "/{id}",
                notes: "can only delete the results for one specific assessement",
                summary: "deletes one specifv assessmentResult for the current user and the assessment with id assId",
                method: "DELETE",
                params: [swagger.pathParam("assId", "ID of the assessment for which to store a result", "string"),
                    swagger.pathParam("id", "ID of the result to delete", "string")],
                "nickname": "deleteAssessmentResult",
                accessLevel: 'al_user',
                beforeCallbacks: []
            },
            action: generic.deleteByIdFn(resultsUrl, AssessmentResult)
        }
    );


    swagger.addGet({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: baseUrl,
            notes: "returns an array of all assessments",
            summary: "returns all assessments in the system",
            method: "GET",
            "responseClass": "Assessment",
            "nickname": "getAssessments",
            accessLevel: 'al_all'
        },
        action: generic.getAllFn(baseUrl, Assessment)
    });

    swagger.addGet({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: baseUrlWithId,
            notes: "returns the assessment by id, pass the Object Id as String ",
            summary: "returns one specific assessment by id",
            params: [swagger.pathParam("id", "ID of the assessment to fetch", "string")],
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("assessment")],
            method: "GET",
            "responseClass": "Assessment",
            "nickname": "getAssessment",
            accessLevel: 'al_all'
        },
        action: generic.getByIdFn(baseUrl, Assessment)

    });

    swagger.addDelete({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: baseUrl,
            notes: "Admin only! do not use if you don't know exactly what this does!",
            summary: "deletes all assessments in the system",
            method: "DELETE",
            "nickname": "deleteAssessments",
            accessLevel: 'al_admin'
        },
        action: generic.deleteAllFn(baseUrl, Assessment)
    });

};