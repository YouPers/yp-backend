/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('Comment'),
    generic = require('./../handlers/generic');

module.exports = function (swagger, config) {

    var baseUrl = '/comments',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addGet({
        spec: {
            description: "Operations about comments",
            path: baseUrlWithId,
            notes: "returns a comment based on id",
            summary: "find comment by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the comment to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Comment",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getCommentById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addGet({
        spec: {
            description: "Operations about comments",
            path: baseUrl,
            notes: "returns all comments, but limits to 100 entries by default, is not owner-constrained, e.g. it returns comments" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest comments",
            summary: "find comment by id",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate,
                generic.params.populatedeep],
            "responseClass": "Comment",
            "nickname": "getCommentById",
            accessLevel: 'al_individual'
        },
        action: generic.getAllFn(baseUrl, Model)
    });

    swagger.addPost({
        spec: {
            description: "Operations about comments",
            path: baseUrl,
            notes: "returns all comments, but limits to 100 entries by default, is not owner-constrained, e.g. it returns comments" +
                "from several users. Use query params sort:'created:-1' and limit to retrieve the newest comments",
            summary: "find comment by id",
            method: "POST",
            param: [swagger.bodyParam("Comment", "new Comment object", "Comment")],
            "responseClass": "Comment",
            "nickname": "postComments",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addDelete({
            spec: {
                description: "Operations about comments",
                path: baseUrlWithId,
                notes: "delete comment",
                summary: "Deletes a comment by id",
                method: "DELETE",
                param: [swagger.pathParam("id", "ID of the comment to be fetched", "string")],
                "nickname": "deleteComment",
                accessLevel: 'al_user'
            },
            action:  generic.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addDelete({
            spec: {
                description: "Operations about comments",
                path: baseUrl,
                notes: "delete all comments",
                summary: "Deletes comments",
                method: "DELETE",
                "nickname": "deleteComments",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};