var generic = require('./generic'),
    Notification = require('../core/Notification'),
    mongoose = require('mongoose'),
    NotificationModel = mongoose.model('Notification'),
    NotificationDismissedModel = mongoose.model('NotificationDismissed'),
    auth = require('../util/auth'),
    error = require('../util/error');

function getStandardQueryOptions(req) {
    return {
        skip: req.query.skip,
        limit: req.query.limit,
        populate: req.query.populate,
        populatedeep: req.query.populatedeep,
        sort: req.query.sort,
        filter: req.query.filter,
        '-filter': req.query['-filter'],
        '+filter': req.query['+filter']
    };
}

var deleteByIdFn = function (baseUrl) {
    return function deleteByIdFn (req, res, next) {

        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({ required: 'id' }));
        }

        // check if user is campaign lead and the administrate flag is set,
        // just delete and don't dismiss the notification
        if (auth.checkAccess(req.user, 'al_campaignlead') &&
            req.params.mode && req.params.mode === 'administrate') {
            return generic.deleteByIdFn(baseUrl, NotificationModel);
        }

        NotificationModel.findById(req.params.id, function(err, notification) {

            if(err) {
                return error.handleError(err, next);
            }

            // just delete the notification if it is a personal invitation for this user
            if(notification.type === 'personalInvitation' && req.user.id.equals(notification.targetQueue)) {
                return generic.deleteByIdFn(baseUrl, NotificationModel);
            }

            var notificationDismissed = new NotificationDismissedModel({
                expiresAt: notification.publishTo,
                user: req.user.id,
                notification: notification.id
            });

            notificationDismissed.save(generic.writeObjCb(req, res, next));

        });

    };
};

var getAllFn = function (req, res, next) {
    var options = getStandardQueryOptions(req);
    if (req.params.campaign && auth.checkAccess(req.user, 'al_campaignlead')) {
        // this is a campaignlead requesting notifications to manage them in a campaign
        if (!req.params.mode) {
            return next(new error.MissingParameterError('mode is required if campaign is passed as param', { required: 'mode' }));
        }
        return Notification.getCampaignNotifications(req.user, req.params.campaign, req.params.mode, req.params.previewdate, options, generic.sendListCb(req, res, next));
    } else {
        // normal user requesting his current notifications
        return Notification.getCurrentNotifications(req.user, options, generic.sendListCb(req, res, next));
    }
};

module.exports = {
    getAllFn: getAllFn,
    deleteByIdFn: deleteByIdFn
};
