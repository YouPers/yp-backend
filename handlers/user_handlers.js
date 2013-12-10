var handlerUtils = require('./handlerUtils'),
    email = require('../util/email');

var postFn = function (baseUrl, UserModel) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, UserModel);

        if (err) {
            return next(err);
        }

        var newObj = new UserModel(req.body);

        // send verificationEmail
        email.send("YouPers Digital Health Plattform <dontreply@youpers.com>", newObj.email, "YouPers: Please verify your email address", "click here", "<b>and here</b>");

        req.log.trace(newObj, 'PostFn: Saving new Object');
        // try to save the new object
        newObj.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn');
                err.statusCode = 409;
                return next(err);
            }
            res.header('location', baseUrl + '/' + newObj._id);
            res.send(201, newObj);
            return next();
        });
    };
};


module.exports = {
    postFn: postFn
};