var generic = require('./generic'),
    Notification = require('../core/Notification'),
    auth = require('../util/auth');

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

var getAllFn = function (req, res, next) {
    var options = getStandardQueryOptions(req);
    if (req.params.campaign && auth.checkAccess(req.user, 'al_campaignlead')) {
        // this is a campaignlead requesting notifications to manage them in a campaign
        return Notification.getCampaignNotifications(req.user, req.params.campaign, options, generic.sendListCb(req, res, next));
    } else {
        // normal user requesting his current notifications
        return Notification.getCurrentNotifications(req.user, options, generic.sendListCb(req, res, next));
    }
};

module.exports = {
    getAllFn: getAllFn
};
