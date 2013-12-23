var handlerUtils = require('./handlerUtils'),
    email = require('../util/email'),
    auth = require('../util/auth'),
    restify = require('restify');

var postFn = function (baseUrl, UserModel) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, UserModel);

        if (err) {
            return next(err);
        }

        var newObj = new UserModel(req.body);

        // assign default role§
        if (newObj.roles.length === 0) {
            newObj.roles = ['individual'];
        }

        if (!auth.canAssign(req.user, newObj.roles)) {
            return next(new restify.NotAuthorizedError("current user has not enough privileges to create a new user with roles " + newObj.roles));
        }

        req.log.trace(newObj, 'PostFn: Saving new Object');
        // try to save the new object
        newObj.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn');
                err.statusCode = 409;
                return next(err);
            }
            // send verificationEmail
            email.send("YouPers Digital Health Plattform <dontreply@youpers.com>", newObj.email, "YouPers: Please verify your email address", "click here", "<b>and here</b>");

            res.header('location', baseUrl + '/' + newObj._id);
            res.send(201, newObj);
            return next();
        });
    };
};


module.exports = {
    postFn: postFn
};