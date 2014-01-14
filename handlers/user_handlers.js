var handlerUtils = require('./handlerUtils'),
    generic = require('./../handlers/generic'),
    email = require('../util/email'),
    auth = require('../util/auth'),
    restify = require('restify'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, User);

        if (err) {
            return next(err);
        }

        var newObj = new User(req.body);

        // assign default roles
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
            email.sendEmailVerification(newObj);

            res.header('location', baseUrl + '/' + newObj._id);
            res.send(201, newObj);
            return next();
        });
    };
};

var emailVerificationPostFn = function(baseUrl) {
    return function(req, res, next) {

        if(req.params.id !== req.user.id) {
            return next(new restify.ConflictError('User ID in request parameters does not match authenticated user'));
        }

        User.findById(req.params.id, function(err, user) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!user) {
                return next(new restify.InvalidArgumentError('Invalid User ID'));
            }

            if(req.body.token === email.encryptEmailAddress(user.email)) {

                user.emailValidatedFlag = true;
                user.save();


                res.send(200, {});
                return next();
            } else {
                return next(new restify.InvalidArgumentError('Invalid Token'));
            }

        });

    };
}


module.exports = {
    postFn: postFn,
    emailVerificationPostFn: emailVerificationPostFn
};