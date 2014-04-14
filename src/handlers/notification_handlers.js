var generic = require('./generic'),
    Notification = require('../core/Notification');

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
    return Notification.getCurrentNotifications(req.user, options, generic.sendListCb(req, res, next));
};

module.exports = {
    getAllFn: getAllFn
};
