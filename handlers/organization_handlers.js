var handlerUtils = require('./handlerUtils'),
    generic = require('./../handlers/generic'),
    auth = require('../util/auth'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
    restify = require('restify'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    _ = require('lodash'),
    fs = require('fs'),
    gm = require('gm');


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


        // TODO: update user roles

        obj.administrators = [req.user.id];

        if(!_.contains(req.user.roles, auth.roles.orgadmin)) {
            req.user.roles.push(auth.roles.orgadmin);
        }

        req.user.save(function(err) {
            if(err) {
                return next(err);
            }
        });


        req.log.trace(obj, 'PostFn: Saving new organization object');

        // try to save the new user and profile objects
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

module.exports = {
    postFn: postFn
};