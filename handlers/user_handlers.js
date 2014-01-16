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

        var newUser = new User(req.body);

        // assign default roles
        if (newUser.roles.length === 0) {
            newUser.roles = ['individual'];
        }

        if (!auth.canAssign(req.user, newUser.roles)) {
            return next(new restify.NotAuthorizedError("current user has not enough privileges to create a new user with roles " + newUser.roles));
        }

        req.log.trace(newUser, 'PostFn: Saving new user and profile objects');

        // try to save the new user and profile objects
        newUser.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn (User Account');
                err.statusCode = 409;
                return next(err);
            }

            // send verificationEmail
            email.sendEmailVerification(newUser);

            res.header('location', baseUrl + '/' + newUser._id);
            res.send(201, newUser);
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