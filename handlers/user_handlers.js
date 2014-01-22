var handlerUtils = require('./handlerUtils'),
    generic = require('./../handlers/generic'),
    email = require('../util/email'),
    auth = require('../util/auth'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
    restify = require('restify'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Profile = mongoose.model('Profile'),
    fs = require('fs'),
    gm = require('gm');

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

var getUser = function(req, res, next, callback) {


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

        callback(user);
    });
};

var emailVerificationPostFn = function(baseUrl) {
    return function(req, res, next) {

        getUser(req, res, next, function(user) {

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


        var sizeA = 100;
        var sizeB = 100;
        var path = req.files.file.path;
        var pathResized = path + "_resized";

        req.log.debug('avatar: resize to \n'+sizeA+'x'+sizeB+path);


        // resize on fs using GraphicMagick
        gm(path)
            .define('jpeg:size='+sizeA+'x'+sizeB) // workspace
            .thumbnail(sizeA, sizeB + '^') // shortest side sizeB
            .gravity('center') // center next operation
            .extent(sizeA, sizeB) // canvas size
            .noProfile() // remove meta
            .write(pathResized, function(err){
                if (err) {
                    return next(new restify.InternalError(err));
                }
                req.log.debug('avatar: resize complete\n' + pathResized);

                // read resized image from fs and store in db

                fs.readFile(pathResized, function (err, data) {

                    var avatar = new Buffer(data).toString('base64');

                    var profile = req.user.profile;
                    profile.avatarImage = avatar;
                    profile.save(function(err, savedProfile, b) {

                        if (err) {
                            return next(new restify.InternalError(err));
                        }

                        res.send({avatarImage: savedProfile.avatarImage});
                        return next();
                    });

                });
            });

    };
};

module.exports = {
    postFn: postFn,
    emailVerificationPostFn: emailVerificationPostFn,
    requestPasswordResetPostFn: requestPasswordResetPostFn,
    passwordResetPostFn: passwordResetPostFn,
    avatarImagePostFn: avatarImagePostFn
};