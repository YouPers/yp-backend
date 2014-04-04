var generic = require('./generic'),
    mongoose = require('mongoose'),
    Notification = mongoose.model('Notification'),
    NOTIFICATION_QUEUE_ALL = "findAnOIDforThis";

var getAllFn = function (req, res, next) {

    var queues = NOTIFICATION_QUEUE_ALL;

    if (req.user) {
        queues.concat(req.user.getNotificationQueues);
    }

    var finder = {targetQueue: {$in: queues}};

    var dbQuery = Notification.find(finder);

    generic.addStandardQueryOptions(req, dbQuery, Notification)
        .exec(generic.sendListCb(req, res, next));

};

module.exports = {
    getAllNotificationsFn: getAllFn
};
