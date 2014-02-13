var stats = require('../util/stats'),
    handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    _ = require('lodash'),
    restify = require('restify'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
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

var postCampaign = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, Campaign);

        if (err) {
            return next(err);
        }

        if(!req.body) {
            return next(new restify.InvalidArgumentError('no body found'));
        }

        var sentCampaign = new Campaign(req.body);

        // check if posting user is an org admin of the organization this new campaign belongs to
        Organization.findById(sentCampaign.organization).exec(function(err, org) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!org) {
                return next(new restify.InvalidArgumentError('Invalid Organization ID'));
            }

            var orgAdmin = _.contains(org.administrators.toString(), req.user.id);

            if (!orgAdmin) {
                var wrongOrgAdminError = new Error('Error in PostFn: Not allowed to create a campaign, as this org admin does not belong to this organization.')
                wrongOrgAdminError.statusCode = 403;
                return next(wrongOrgAdminError);
            }

            // check if campaing start/end timespan is between 1 week and a half year, might have to be adapted later on

            if (sentCampaign.start && sentCampaign.end &&
                (moment(sentCampaign.end).diff(moment(sentCampaign.start), 'weeks') < 1 ||
                    moment(sentCampaign.end).diff(moment(sentCampaign.start), 'weeks') > 26)) {
                var wrongTimeSpanError = new Error('Error in PostFn: Not allowed to create a campaign which does not last between 1 and 26 weeks.')
                wrongTimeSpanError.statusCode = 409;
                return next(wrongTimeSpanError);
            }

            // TODO: update user roles

            sentCampaign.campaignLeads = [req.user.id];

            if(!_.contains(req.user.roles, auth.roles.campaignlead)) {
                req.user.roles.push(auth.roles.campaignlead);
            }

            // update user with his new role as campaign lead

            req.user.save(function(err) {
                if(err) {
                    return next(err);
                }
            });


            req.log.trace(sentCampaign, 'PostFn: Saving new Campaign object');

            // try to save the new campaign object
            sentCampaign.save(function (err) {
                if (err) {
                    req.log.info({Error: err}, 'Error Saving in PostFn (Campaign)');
                    err.statusCode = 409;
                    return next(err);
                }

                res.header('location', baseUrl + '/' + sentCampaign._id);
                res.send(201, sentCampaign);
                return next();
            });

        });

    };
};

function putCampaign(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated Campaign');

    if (!req.body) {
        return next(new restify.InvalidContentError('exptected JSON body in POST'));
    }

    var sentCampaign = req.body;
    req.log.trace({body: sentCampaign}, 'parsed req body');


    Campaign.findById(req.params.id).exec(function (err, reloadedCampaign) {
        if (err) {
            return next(err);
        }
        if (!reloadedCampaign) {
            return next(new restify.ResourceNotFoundError('No campaign found with Id: ' + sentCampaign.id));
        }

        _.extend(reloadedCampaign, req.body);

        // check if posting user is an org admin of the organization this new campaign belongs to
        Organization.findById(reloadedCampaign.organization).exec(function(err, org) {
            if(err) {
                return next(new restify.InternalError(err));
            }
            if(!org) {
                return next(new restify.InvalidArgumentError('Invalid Organization ID'));
            }

            var orgAdmin = _.contains(org.administrators.toString(), req.user.id);

            var campaignLead = _.contains(reloadedCampaign.campaignLeads.toString(), req.user.id);

            if (!orgAdmin && !campaignLead) {
                var wrongOrgAdminError = new Error('Error in PostFn: Not allowed to create a campaign, as this user is neither org admin of this org nor a campaign lead of this campaign.')
                wrongOrgAdminError.statusCode = 403;
                return next(wrongOrgAdminError);
            }

            if (moment(reloadedCampaign.end).diff(moment(reloadedCampaign.start), 'weeks') < 1 ||
                moment(reloadedCampaign.end).diff(moment(reloadedCampaign.start), 'weeks') > 26) {
                var wrongTimeSpanError = new Error('Error in PutFn: Not allowed to update a campaign which does not last between 1 and 26 weeks.')
                wrongTimeSpanError.statusCode = 409;
                return next(wrongTimeSpanError);
            }

            req.log.trace(reloadedCampaign, 'PutFn: Updating existing Object');

            reloadedCampaign.save(function (err) {
                if (err) {
                    req.log.error({Error: err}, 'Error updating in PutFn');
                    err.statusCode = 409;
                    return next(err);
                }

                res.header('location', '/api/v1/activitiesPlanned' + '/' + reloadedCampaign._id);
                res.send(201, reloadedCampaign);
                return next();
            });
        });

    });


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
    postCampaign: postCampaign,
    putCampaign: putCampaign,
    getAllForUserFn: getAllForUserFn
};