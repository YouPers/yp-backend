var handlerUtils = require('./handlerUtils'),
    generic = require('./../handlers/generic'),
    email = require('../util/email'),
    auth = require('../util/auth'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
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

            if(req.body.token === email.encryptLinkToken(user.email)) {

                user.emailValidatedFlag = true;
                user.save();


                res.send(200, {});
                return next();
            } else {
                return next(new restify.InvalidArgumentError('Invalid Token'));
            }

        });

    };
};


var requestPasswordResetPostFn = function(baseUrl) {
    return function(req, res, next) {

        // check payload
        if (!req.body || !req.body.usernameOrEmail ) {
            return next(new restify.InvalidArgumentError('usernameOrEmail required in POST body'));
        }


        User.findOne().or([{username: req.body.usernameOrEmail}, {email: req.body.usernameOrEmail}]).exec(function(err, user) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!user) {
                return next(new restify.InvalidArgumentError('unknown username or email'));
            }

            email.sendPasswordResetMail(user);

            res.send(200, {});
            return next();

        });

    };

};

var passwordResetPostFn = function(baseUrl) {
    return function(req, res, next) {

        // check payload
        if (!req.body || !req.body.token || !req.body.password) {
            return next(new restify.InvalidArgumentError('Token and Password required in POST body'));
        }

        var decryptedToken;

        try {
             decryptedToken = email.decryptLinkToken(req.body.token);
        } catch (err) {
            return next(new restify.InvalidArgumentError('Invalid Token'));
        }

        var userId = decryptedToken.split('|')[0];
        var tokentimestamp = decryptedToken.split('|')[1];

        if (new Date().getMilliseconds() - tokentimestamp > config.linkTokenEncryption.maxTokenLifetime) {
            return next(new restify.InvalidArgumentError('Password Reset Link is expired, please click again on password reset'));
        }

        User.findById(userId, function(err, user) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!user) {
                return next(new restify.InvalidArgumentError('Unknown User'));
            }

            //
             user.hashed_password = undefined;
             user.password = req.body.password;
             user.save(function(err, saveduser) {

                 res.send(200, {});
                 return next();
             });

        });

    };
};


module.exports = {
    postFn: postFn,
    emailVerificationPostFn: emailVerificationPostFn,
    requestPasswordResetPostFn: requestPasswordResetPostFn,
    passwordResetPostFn: passwordResetPostFn
};