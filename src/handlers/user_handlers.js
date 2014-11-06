var mongoose = require('ypbackendlib').mongoose,
    User = mongoose.model('User'),
    generic = require('ypbackendlib').handlers;


function getFriends(baseUrl, Model) {
    return function(req, res, next) {
        var finder = {
            _id: {$ne: req.user._id}
        };

        if (req.user.campaign) {
            finder.campaign = req.user.campaign._id;
        }

        var query = User.find(finder);
        generic.processDbQueryOptions(req.query, query, User, req.locale).exec(generic.sendListCb(req, res, next));

    };
}


module.exports = {
    getFriends: getFriends
};