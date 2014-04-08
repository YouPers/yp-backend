var generic = require('./generic'),
    Notification = require('../core/Notification');

var getAllFn = function (req, res, next) {
    return Notification.getCurrentNotifications(req.user, generic.sendListCb(req, res, next));
};

module.exports = {
    getAllFn: getAllFn
};
