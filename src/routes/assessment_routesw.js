/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Assessment = mongoose.model('Assessment'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    generic = require('../handlers/generic'),
    assessment_handlers = require('../handlers/assessment_handlers.js');


module.exports = function (swagger, config) {

    var baseUrl = '/assessments',
        baseUrlWithId = baseUrl + "/{id}";
    var resultsUrl = baseUrl + '/{assessmentId}/results';
    var answerUrl = baseUrl + '/{assessmentId}/answers/{questionId}';

    swagger.addPut({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: baseUrlWithId,
            notes: "updates an existing assessment",
            summary: "stores an update for the assessment with id assessmentId",
            method: "PUT",
            params: [swagger.pathParam("id", "ID of the assessment", "string"),
                swagger.bodyParam("assessment", "The assessment to store, or only some keys of it", "AssessmentResult")],
            "responseMessages": [
                {
                    "code": 200,
                    "message": "Updated",
                    "responseModel": "Assessment"
                },
                {
                    "code": 401,
                    "message": "Unauthorized: client or user not authorized to call this method"
                }
            ],
            "nickname": "putAssessment",
            accessLevel: 'al_productadmin',
            beforeCallbacks: []
        },
        action: generic.putFn(baseUrl, Assessment)
    });

    swagger.addPost({
        spec: {
            description: "Operations about assessments and assessmentResults",
            path: resultsUrl,
            notes: "stores a new result",
            summary: "stores a new result for the assessment with id assessmentId",
            method: "POST",
            params: [swagger.pathParam("assessmentId", "ID of the assessment for which to store a result", "string"),
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
                }
            ],
            "nickname": "postAssessmentResult",
            responseClass: "AssessmentResult",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: assessment_handlers.assessmentResultPostFn(resultsUrl, AssessmentResult)
    });

    swagger.addPut({
        spec: {
            description: "Put an answer of an assessment result",
            path: answerUrl,
            notes: "Put an answer of an assessment result",
            summary: "Put an answer of an assessment result",
            method: "PUT",
            params: [swagger.pathParam("assessmentId", "ID of the assessment for which to save and result answer", "string"),
                swagger.bodyParam("assessmentResultAnswer", "The assessment answer to store", "AssessmentResultAnswer"),
                swagger.pathParam("questionId", "ID of the question for which to save and result answer", "string")],
            "responseMessages": [],
            "nickname": "assessmentResultAnswerPut",
            accessLevel: 'al_individual',
            beforeCallbacks: []
        },
        action: assessment_handlers.assessmentResultAnswerPutFn()
    });

    swagger.addGet({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl + '/newest',
                notes: "always returns zero or one result, the newest result is the one with the newest created timestamp",
                summary: "returns a the newest assessmentResult for the current user and the assessment with id assessmentId",
                method: "GET",
                params: [swagger.pathParam("assessmentId", "ID of the assessment for which to store a result", "string"),
                    generic.params.populate,
                    generic.params.populatedeep],
                "responseClass": "Array[AssessmentResult]",
                "errorResponses": [swagger.errors.invalid('assessmentId'), swagger.errors.notFound("assessment")],
                "nickname": "getNewestAssessmentResult",
                accessLevel: 'al_individual',
                beforeCallbacks: []
            },
            action: assessment_handlers.getNewestResult(resultsUrl, AssessmentResult)
        }
    );

    swagger.addGet({
            spec: {
                description: "Operations about assessments and assessmentResults",
                path: resultsUrl,
                notes: "returns an array of assessmentResults",
                summary: "returns all assessmentResult for the current user and the assessment with id assessmentId",
                method: "GET",
                params: [swagger.pathParam("assessmentId", "ID of the assessment for which to store a result", "string"),
                        generic.params.populate,
                        generic.params.populatedeep],
                "responseClass": "Array[AssessmentResult]",
                "errorResponses": [swagger.errors.invalid('assessmentId'), swagger.errors.notFound("assessment")],
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
                summary: "deletes all assessmentResults for the current user and the assessment with id assessmentId",
                method: "DELETE",
                params: [swagger.pathParam("assessmentId", "ID of the assessment for which to store a result", "string")],
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
                summary: "deletes one specifv assessmentResult for the current user and the assessment with id assessmentId",
                method: "DELETE",
                params: [swagger.pathParam("assessmentId", "ID of the assessment for which to store a result", "string"),
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
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            method: "GET",
            "responseClass": "Array[Assessment]",
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
            params: [swagger.pathParam("id", "ID of the assessment to fetch", "string"),
            	generic.params.populate,
            	generic.params.populatedeep
            ],
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