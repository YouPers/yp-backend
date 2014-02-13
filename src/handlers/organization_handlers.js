var handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    image = require('../util/image'),
    restify = require('restify'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    _ = require('lodash');


var getOrganization = function(req, res, next, callback) {

    Organization.findById(req.params.id)
        .exec(function(err, org) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!org) {
                return next(new restify.InvalidArgumentError('Invalid Organization ID'));
            }

            callback(org);
        });
};

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, Organization);

        if (err) {
            return next(err);
        }

        if(!req.body) {
            return next(new restify.InvalidArgumentError('no body found'));
        }
        var obj = new Organization(req.body);

        obj.administrators = [req.user.id];

        if(!_.contains(req.user.roles, auth.roles.orgadmin)) {
            req.user.roles.push(auth.roles.orgadmin);
            req.user.save(function(err) {
                if(err) {
                    return next(err);
                }
            });
        }

        req.log.trace(obj, 'PostFn: Saving new organization object');

        // try to save the new organization object
        obj.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn (Organization)');
                err.statusCode = 409;
                return next(err);
            }

            res.header('location', baseUrl + '/' + obj._id);
            res.send(201, obj);
            return next();
        });

    };
};


var getAllForUserFn = function (baseUrl) {
    return function (req, res, next) {

        var userId = req.user.id;

        Organization.find({administrators: userId})
            .exec(function(err, organizations) {

                if (err) {
                    return next(err);
                }

                if (!organizations) {
                    res.send(204, []);
                    return next();
                }

                res.send(200, organizations);
                return next();
            });
    };
};

var avatarImagePostFn = function(baseUrl) {
    return function(req, res, next) {

        image.resizeImage(req, req.files.file.path, function (err, image) {
            if (err) {
                return next(err);
            }

            getOrganization(req, res, next, function (org) {

                org.avatar = image;
                org.save(function(err, savedOrg) {
                    if (err) {
                        return next(new restify.InternalError(err));
                    }
                });

                // send response
                res.send({avatar: org.avatar});
                return next();
            });

        });
    };
};

module.exports = {
    postFn: postFn,
    getAllForUserFn: getAllForUserFn,
    avatarImagePostFn: avatarImagePostFn
};