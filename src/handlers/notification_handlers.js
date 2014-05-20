var generic = require('./generic'),
    Notification = require('../core/Notification'),
    mongoose = require('mongoose'),
    NotificationModel = mongoose.model('Notification'),
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


/**
 * deletes a notification.
 *
 * takes care that notifications that do not actually belong to/are authored by the user requesting the deletion
 * and are targeted to multiple users are not really deleted but only dismissed (=hidden) for the user requesting deletion.
 *
 * Real Deletion can only happen if:
 * 1. the requesting user is the only recipient OR
 * 2. the requesting user is the author of the notification and wants to really delete it for every recipient.
 *
 * in all other cases the notification is only dismissed. The differentiation between 1. and 2. is implemented in the
 * Notification.dismissNotification method.
 *
 * Special Case:
 * When a campaignlead sends a DELETE for a notification and he is the author of the notification we need to differentiate
 * whether:
 * a) he really wants to delete the notification for all recipients
 * b) he only clicked the "X" the delete/hide the notification for himself as a user.
 *
 * This is done by passing the param "administrate". Only if this param is present we assume case a), otherwise
 * we just dismiss.
 *
 * @param baseUrl
 * @returns {deleteByIdFn}
 */
var deleteByIdFn = function (baseUrl) {
    return function deleteByIdFn (req, res, next) {

        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({ required: 'id' }));
        }

        // check if user is campaign lead and the administrate flag is set,
        // just delete and don't dismiss the notification
        if (auth.checkAccess(req.user, 'al_systemadmin') || auth.checkAccess(req.user, 'al_campaignlead') &&
            req.params.mode && req.params.mode === 'administrate') {
            return generic.deleteByIdFn(baseUrl, NotificationModel)(req, res, next);
        }

        Notification.dismissNotification(req.params.id, req.user, function(err, notification) {
            if(err) {
                return error.handleError(err, next);
            }
            res.send(200);
            return next();
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
