var error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    email = require('../util/email'),
    image = require('../util/image'),
    auth = require('../util/auth'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    _ = require('lodash');

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, User);

        if (err) {
            return error.handleError(err, next);
        }

        var password = req.password || req.body.password;
        if (!password) {
            return next(new error.MissingParameterError('User needs a password', {required: 'password'}));
        }
        req.body.password = password;

        var newUser = new User(req.body);

        // assign default roles
        if (newUser.roles.length === 0) {
            newUser.roles = ['individual'];
        }

        if (!auth.canAssign(req.user, newUser.roles)) {
            return next(new error.NotAuthorizedError(
                'The user is not authorized to assign these roles.', {
                    roles: newUser.roles
                }
            ));
        }

        req.log.trace(newUser, 'PostFn: Saving new user and profile objects');

        // try to save the new user and profile objects
        newUser.save(function (err) {
            if (err) { return error.handleError(err, next); }

            // send verificationEmail
            email.sendEmailVerification(newUser, req.i18n);

            res.header('location', req.url + '/' + newUser._id);
            res.send(201, newUser);
            return next();
        });
    };
};

var validateUserPostFn = function(baseUrl) {
    return function (req, res, next) {
        var fields = 'username email'.split(' ');

        var field = _.find(fields, function (field) {
            return req.body[field];
        });

        if(field) {
            var query = {};
            query[field] = req.body[field].toLowerCase();

            User.findOne(query).select(field).exec(function(err, value) {
                if(err) { return error.handleError(err, next); }
                if(value) {
                    // we use a HTTP error to communicate the fact that this is a duplicate username or email
                    // but there is no reason to fill the server logs with this, as this is an expected case
                    // therefore we suppress the automatic logging of errors
                    var errorMsg = new error.ConflictError(field + ' is already in use', { value: query[field] } );
                    errorMsg.doNotLog = true;
                    return next(errorMsg);
                } else {
                    res.send(200);
                    return next();
                }
            });
        } else {
            return next(new error.MissingParameterError('no field to validate was provided', { expectedFields: fields }));
        }
    };
};

var getUser = function(req, res, next, callback) {


    if(req.params.id !== req.user.id) {
        return next(new error.ConflictError('User ID in request parameters does not match authenticated user', {
            requestUserId: req.params.id,
            authenticatedUserId: req.user.id
        }));
    }

    User.findById(req.params.id)
        .select(User.privatePropertiesSelector)
        .exec(function(err, user) {
        if(err) { return error.handleError(err, next); }
        if(!user) {
            return next(new error.ResourceNotFoundError('User not found', { id: req.params.id }));
        }

        callback(user);
    });
};

var emailVerificationPostFn = function(baseUrl) {
    return function(req, res, next) {

        getUser(req, res, next, function(user) {

            if(req.body && req.body.token === email.encryptLinkToken(user.email)) {

                user.emailValidatedFlag = true;
                user.save();


                res.send(200, {});
                return next();
            } else if(!req.body || !req.body.token) {
                return next(new error.MissingParameterError({ required: 'token' }));
            } else {
                return next(new error.InvalidArgumentError('Invalid Token', { token: req.body.token }));
            }

        });

    };
};


var requestPasswordResetPostFn = function(baseUrl) {
    return function(req, res, next) {

        // check payload
        if (!req.body || !req.body.usernameOrEmail ) {
            return next(new error.MissingParameterError({ required: 'usernameOrEmail'}));
        }


        User.findOne()
            .or([{username: req.body.usernameOrEmail}, {email: req.body.usernameOrEmail}])
            .select('+email +username')
            .exec(function(err, user) {
            if(err) { error.handleError(err, next); }
            if(!user) {
                return next(new error.InvalidArgumentError('unknown username or email', { usernameOrEmail: req.body.usernameOrEmail }));
            }

            email.sendPasswordResetMail(user, req.i18n);

            res.send(200, {});
            return next();

        });

    };

};

var passwordResetPostFn = function(baseUrl) {
    return function(req, res, next) {

        // check payload
        if (!req.body || !req.body.token || !req.body.password) {
            return next(new error.MissingParameterError({ required: ['token', 'password']}));
        }

        var decryptedToken;

        try {
             decryptedToken = email.decryptLinkToken(req.body.token);
        } catch (err) {
            return next(new error.InvalidArgumentError('Invalid Token', { token: req.body.token }));
        }

        var userId = decryptedToken.split(email.linkTokenSeparator)[0];
        var tokentimestamp = decryptedToken.split(email.linkTokenSeparator)[1];

        if (new Date().getMilliseconds() - tokentimestamp > config.linkTokenEncryption.maxTokenLifetime) {
            return next(new error.InvalidArgumentError('Token is expired', { token: req.body.token }));
        }

        User.findById(userId)
            .select(User.privatePropertiesSelector)
            .exec(function(err, user) {
            if(err) { return error.handleError(err, next); }
            if(!user) {
                return next(new error.ResourceNotFoundError('User not found', { id: userId }));
            }

             user.hashed_password = undefined;
             user.password = req.body.password;
             user.save(function(err, saveduser) {

                 res.send(200, {});
                 return next();
             });

        });

    };
};

var avatarImagePostFn = function(baseUrl) {
    return function(req, res, next) {

        image.resizeImage(req, req.files.file.path, 'user', function (err, image) {

            if (err) {
                return next(err);
            }

            var user = req.user;
            user.avatar = image;
            user.save(function(err, savedUser) {
                if (err) { return error.handleError(err, next); }
            });

            // send response
            res.send({avatar: user.avatar});
            return next();
        });

    };
};

module.exports = {
    postFn: postFn,
    validateUserPostFn: validateUserPostFn,
    emailVerificationPostFn: emailVerificationPostFn,
    requestPasswordResetPostFn: requestPasswordResetPostFn,
    passwordResetPostFn: passwordResetPostFn,
    avatarImagePostFn: avatarImagePostFn
};