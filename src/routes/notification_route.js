var mongoose = require('mongoose'),
    Model = mongoose.model('Notification'),
    generic = require('ypbackendlib').handlers,
    notificationHandlers = require('../handlers/notification_handlers');

module.exports = function (swagger) {

    var baseUrl = '/notifications',
        baseUrlWithId = baseUrl + '/{id}';

    swagger.addOperation({
        spec: {
            description: "Operations about notifications",
            path: baseUrlWithId,
            notes: "returns a notification based on id",
            summary: "find notification by id",
            method: "GET",
            params: [swagger.pathParam("id", "ID of the notification to be fetched", "string"),
                generic.params.populate],
            "responseClass": "Notification",
            "errorResponses": [swagger.errors.invalid('id'), swagger.errors.notFound("user")],
            "nickname": "getNotificationById",
            accessLevel: 'al_individual'
        },
        action: generic.getByIdFn(baseUrl, Model)
    });

    swagger.addOperation({
        spec: {
            description: "Operations about notifications",
            path: baseUrl,
            notes: "returns all notifications that are relevant for the current user, but limits to 100 entries by default." +
                "Relevant meaning: all currently valid/published notifications in queues this is user is subscribed to." +
                "Use query params sort:'created:-1' and limit to retrieve the newest notifications",
            summary: "returns all my current notifications",
            method: "GET",
            params: [generic.params.sort,
                generic.params.limit,
                generic.params.filter,
                generic.params.populate],
            "responseClass": "Array[Notification]",
            "nickname": "getNotification",
            accessLevel: 'al_individual'
        },
        action: notificationHandlers.getAllFn
    });

    swagger.addOperation({
        spec: {
            description: "Operations about notifications",
            path: baseUrl,
            notes: "POSTs a new notification",
            summary: "POSTs a new notification",
            method: "POST",
            params: [swagger.bodyParam("Notification", "new Notification object", "Notification")],
            "responseClass": "Notification",
            "nickname": "postNotifications",
            accessLevel: 'al_individual'
        },
        action:  generic.postFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about notifications",
                path: baseUrlWithId,
                notes: "delete/dismiss notification",
                summary: "Deletes or dismisses a notification by id",
                method: "DELETE",
                params: [swagger.pathParam("id", "ID of the notification to be fetched", "string")],
                "nickname": "deleteNotification",
                accessLevel: 'al_user'
            },
            action:  notificationHandlers.deleteByIdFn(baseUrl, Model)
        }
    );

    swagger.addOperation({
            spec: {
                description: "Operations about notifications",
                path: baseUrl,
                notes: "delete all notifications",
                summary: "Deletes notifications",
                method: "DELETE",
                "nickname": "deleteNotifications",
                accessLevel: 'al_admin'
            },
            action:  generic.deleteAllFn(baseUrl, Model)
        }
    );

};