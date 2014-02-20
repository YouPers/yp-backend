var stats = require('../util/stats'),
    handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    _ = require('lodash'),
    restify = require('restify'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    async = require('async'),
    email = require('../util/email'),
    moment = require('moment');

var getCampaignStats = function (baseUrl, Model) {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        if (!req.params || !req.params.id) {
            return next(new restify.InvalidArgumentError('campaignId is required'));
        }
        var type = req.params.type;
        if (!type) {
            return next(new restify.InvalidArgumentError('type param required for this URI'));
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

var validateCampaign = function validateCampaign(campaign, userId, type, next) {
    // check if posting user is an org admin of the organization this new campaign belongs to
    Organization.findById(campaign.organization).exec(function(err, org) {
        if(err) {
            return next(new restify.InternalError(err));
        }
        if(!org) {
            return next(new restify.InvalidArgumentError('Invalid Organization ID'));
        }

        var orgAdmin = _.contains(org.administrators.toString(), userId);

        if (type === "PUT") {

            var campaignLead = _.contains(campaign.campaignLeads.toString(), userId);

            if (!orgAdmin && !campaignLead) {
                return next(new restify.NotAuthorizedError('Error in PostFn: Not allowed to create a campaign, as this user is neither org admin of this org nor a campaign lead of this campaign.'));

            }

        } else {

            if (!orgAdmin) {
                return next(new restify.NotAuthorizedError('Error in PostFn: Not allowed to create a campaign, as this org admin does not belong to this organization.'));

            }

        }

        // check if campaing start/end timespan is between 1 week and a half year, might have to be adapted later on

        if (campaign.start && campaign.end &&
            (moment(campaign.end).diff(moment(campaign.start), 'weeks') < 1 ||
                moment(campaign.end).diff(moment(campaign.start), 'weeks') > 26)) {
            return next(new restify.InvalidArgumentError('Error in PostFn: Not allowed to create a campaign which does not last between 1 and 26 weeks.'));
        }

        return next();

    });

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

        validateCampaign(sentCampaign, req.user.id, "POST", function (err) {
            if (err) {
                return next(err);
            }

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

        validateCampaign(reloadedCampaign, req.user.id, "PUT", function (err) {
            if (err) {
                return next(err);
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

}


var getAllForUserFn = function (baseUrl) {
    return function (req, res, next) {

        var userId = req.user.id;

        Campaign.find({campaignLeads: userId})
            .exec(function(err, campaigns) {

                if (err) {
                    return next(err);
                }

                res.send(200, campaigns);
                return next();
            });
    };
};

var postCampaignLeadInviteFn = function postCampaignLeadInviteFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new restify.InvalidArgumentError('missing required CampaignId in URL'));
    }
    if (!req.body || !req.body.email) {
        return next(new restify.InvalidArgumentError('missing required email attribute in body'));
    }

    // split up the email field, in case we got more than one mail
    var emails;
    if (_.isArray(req.body.email)) {
        emails = req.body.email;
    } else if (req.body.email.indexOf(' ') !== -1) {
        emails = req.body.email.split(' ');
    } else if (req.body.email.indexOf(';') !== -1) {
        emails = req.body.email.split(';');
    } else if (req.body.email.indexOf(',') !== -1) {
        emails = req.body.email.split(',');
    } else {
        emails = [req.body.email];
    }

    var locals = {
    };
    async.series([
        // first load Campaign
        function (done) {
            Campaign.findById(req.params.id)
                .populate('organization')
                .exec(function (err, campaign) {
                    if (err) {
                        return done(err);
                    }
                    if (!campaign) {
                        return done(new restify.InvalidArgumentError('Campaign: ' + req.params.id + ' not found.'));
                    }

                    // check whether the posting user is a campaignLead of the campaign
                    if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                        return done(new restify.NotAuthorizedError('You are not authorized to invite someone for this campaign.'));
                    }
                    locals.campaign = campaign;
                    return done();
                });
        },
        // for each email try whether we have a user in the Db with this email address and, if yes, load the user
        // to personalize the email then send the invitation mail
        // if we do not find a user for this email we send the same email but without personalization.
        function (done) {
            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUser) {
                            if (err) {
                                return done(err);
                            }
                            email.sendCampaignLeadInvite(emailaddress, req.user, locals.campaign, invitedUser && invitedUser[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    done();
                });
        }
    ], function (err) {
        if (err) {
            return next(err);
        }
        res.send(200);
        return next();
    });
};

var assignCampaignLeadFn = function assignCampaignLeadFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new restify.InvalidArgumentError('missing required CampaignId in URL'));
    }
    if (!req.params.token) {
        return next(new restify.InvalidArgumentError('missing required token query parameter'));
    }
    if (!req.user) {
        return next(new restify.InvalidArgumentError('missing authenticated user'));
    }

    var tokenElements;

    try {
        tokenElements = email.decryptLinkToken(req.params.token).split(email.linkTokenSeparator);
    } catch (err) {
        return next(new restify.InvalidArgumentError('Invalid Token'));
    }

    // tokenElements[0] must be the campaignId
    if (tokenElements[0] !== req.params.id) {
        return next(new restify.InvalidArgumentError('InvalidToken: campaignId not correct'));
    }

    // tokenElements[1] should be the email-address that was invited
    if (tokenElements[1] !== req.user.email) {
        return next(new restify.InvalidArgumentError('InvalidToken: emailaddress not correct'));
    }

    // tokenElements[2], if it is defined should be the user id of the invited user
    if (tokenElements[2] && (tokenElements[2] !== req.user.id)) {
        return next(new restify.InvalidArgumentError('InvalidToken: user id  not correct'));
    }

    Campaign.findById(req.params.id)
        .exec(function (err, campaign) {
            if (err) {
                return next(err);
            }
            if (!campaign) {
                return next(new restify.InvalidArgumentError('Campaign: ' + req.params.id + ' not found.'));
            }

            // we check whether we need to update the campaignLeads collection of the campaign
            if (!_.contains(campaign.campaignLeads.toString(),req.user.id)) {
                campaign.campaignLeads.push(req.user._id);
                campaign.save(function(err) {
                    if (err) {
                        return next(err);
                    }
                });
            }

            // check whether we need to add the campaignLead role to the user
            if (!_.contains(req.user.roles, auth.roles.campaignlead)) {
                req.user.roles.push(auth.roles.campaignlead);
                req.user.save(function(err) {
                    if (err) {
                        return next(err);
                    }
                });
            }

            res.send(200, campaign);
            return next();
        });


};

module.exports = {
    getCampaignStats: getCampaignStats,
    postCampaign: postCampaign,
    putCampaign: putCampaign,
    getAllForUserFn: getAllForUserFn,
    assignCampaignLead: assignCampaignLeadFn,
    postCampaignLeadInvite: postCampaignLeadInviteFn
};