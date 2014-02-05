var stats = require('../util/stats'),
    handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    _ = require('lodash'),
    restify = require('restify'),
    mongoose = require('mongoose'),
    Campaign = mongoose.model('Campaign');

var getCampaignStats = function (baseUrl, Model) {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        if (!req.params || !req.params.id) {
            res.send(204);
            return next();
        }
        var type = req.params.type;
        if (!type) {
            return next('type param required for this URI');
        }
        var query = stats.queries(req.params.range,'campaign', req.params.id)[type];

        query.exec(function (err, result) {
            if (err) {
                return next(err);
            }
            res.send(result);
            return next();
        });


    };
};

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, Campaign);

        if (err) {
            return next(err);
        }

        if(!req.body) {
            return next(new restify.InvalidArgumentError('no body found'));
        }
        var obj = new Campaign(req.body);


        // TODO: update user roles

        obj.campaignLeads = [req.user.id];

        if(!_.contains(req.user.roles, auth.roles.campaignlead)) {
            req.user.roles.push(auth.roles.campaignlead);
        }

        req.user.save(function(err) {
            if(err) {
                return next(err);
            }
        });


        req.log.trace(obj, 'PostFn: Saving new Campaign object');

        // try to save the new campaign object
        obj.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn (Campaign)');
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

        Campaign.find({campaignLeads: userId})
            .exec(function(err, campaigns) {

                if (err) {
                    return next(err);
                }

                if (!campaigns) {
                    res.send(204, []);
                    return next();
                }

                res.send(200, campaigns);
                return next();
            });
    };
};

module.exports = {
    getCampaignStats: getCampaignStats,
    postFn: postFn,
    getAllForUserFn: getAllForUserFn
};