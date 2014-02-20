var handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    image = require('../util/image'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    _ = require('lodash');


var getOrganization = function(req, res, next, callback) {

    Organization.findById(req.params.id)
        .exec(function(err, org) {
            if(err) {
                return error.handleError(err, next);
            }
            if(!org) {
                return next(new error.ResourceNotFoundError('Organization not found', { id: req.params.id }));
            }

            callback(org);
        });
};

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, Organization);

        if (err) {
            return error.handleError(err, next);
        }

        if(!req.body) {
            return next(new error.MissingParameterError({ required: 'organization object' }));
        }
        var obj = new Organization(req.body);

        obj.administrators = [req.user.id];

        if(!_.contains(req.user.roles, auth.roles.orgadmin)) {
            req.user.roles.push(auth.roles.orgadmin);
            req.user.save(function(err) { if(err) { return error.handleError(err, next); } });
        }

        req.log.trace(obj, 'PostFn: Saving new organization object');

        // try to save the new organization object
        obj.save(function (err) {
            if(err) { return error.handleError(err, next); }

            res.header('location', baseUrl + '/' + obj._id);
            res.send(201, obj);
            return next();
        });

    };
};

/**
 * A org-Admin may see his organisation
 * A CampaignLead may see the organisation where he has campaigns in.
 *
 * @param baseUrl
 * @returns {Function}
 */
var getAllForUserFn = function (baseUrl) {
    return function (req, res, next) {

        var userId = req.user.id;

        Campaign.find({campaignLeads: userId}).exec(function(err, campaigns) {
            var orgs = _.map(campaigns, 'organization');

            Organization.find().or([{administrators: userId}, {_id: {$in: orgs}}])
                .exec(function(err, organizations) {

                    if(err) { return error.handleError(err, next); }

                    res.send(200, organizations);
                    return next();
                });


        });


    };
};

var avatarImagePostFn = function(baseUrl) {
    return function(req, res, next) {

        image.resizeImage(req, req.files.file.path, function (err, image) {
            if(err) { return error.handleError(err, next); }

            getOrganization(req, res, next, function (org) {

                org.avatar = image;
                org.save(function(err, savedOrg) { if(err) { return error.handleError(err, next); } });

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