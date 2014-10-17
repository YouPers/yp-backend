var stats = require('../util/stats'),
    handlerUtils = require('ypbackendlib').handlerUtils,
    auth = require('ypbackendlib').auth,
    _ = require('lodash'),
    error = require('ypbackendlib').error,
    mongoose = require('ypbackendlib').mongoose,
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    SocialInteraction = require('../core/SocialInteraction'),
    async = require('async'),
    email = require('../util/email'),
    image = require('../util/image'),
    moment = require('moment'),
    generic = require('ypbackendlib').handlers,
    config = require('../config/config');

var getCampaign = function (id, cb) {

    Campaign.findById(id)
        .exec(function (err, obj) {
            if (err) {
                return error.handleError(err, cb);
            }
            if (!obj) {
                return cb(new error.ResourceNotFoundError('Campaign not found', { id: id }));
            }

            cb(null, obj);
        });
};

var getCampaignStats = function (baseUrl, Model) {
    return function (req, res, next) {
        // calculate Assessment stats for this Campaign
        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({
                required: 'id'
            }));
        }
        var type = req.params.type;
        if (!type) {
            return next(new error.MissingParameterError({
                required: 'type'
            }));
        }
        var query = stats.queries(req.params.range, 'campaign', req.params.id)[type];

        query.exec(function (err, result) {
            if (err) {
                return error.handleError(err, next);
            }
            res.send(result);
            return next();
        });


    };
};

var validateCampaign = function validateCampaign(campaign, userId, type, next) {
    // check if posting user is an org admin of the organization this new campaign belongs to
    Organization.find({administrators: userId}).exec(function (err, organizations) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!organizations || organizations.length !== 1) {
            return next(new error.ConflictError("user is administrator for more than one organization", {
                organizations: organizations
            }));
        }
        var org = organizations[0];

        campaign.organization = org;

        var orgAdmin = _.contains(org.administrators.toString(), userId);

        if (type === "PUT") {

            var campaignLead = _.contains(campaign.campaignLeads.toString(), userId);

            if (!orgAdmin && !campaignLead) {
                return next(new error.NotAuthorizedError('Not authorized to create a campaign, the user is neither ' +
                    'orgadmin of the organization nor a campaignlead of the campaign.', {
                    campaignId: campaign.id,
                    organizationId: org.id,
                    userId: userId
                }));
            }
        } else {

            if (!orgAdmin) {
                return next(new error.NotAuthorizedError('Not authorized to create a campaign, this orgadmin does not belong to this organization.', {
                    organizationId: org.id,
                    userId: userId
                }));
            }
        }

        // check if campaing start/end timespan is between 1 week and a half year, might have to be adapted later on

        if (campaign.start && campaign.end &&
            (moment(campaign.end).diff(moment(campaign.start), 'weeks') < 1 ||
                moment(campaign.end).diff(moment(campaign.start), 'weeks') > 26)) {
            return next(new error.InvalidArgumentError('Campaign duration must be between 1 and 26 weeks.', {
                invalid: ['start', 'end']
            }));
        }
        return next();
    });

};

var postCampaign = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, Campaign);

        if (err) {
            return error.handleError(err, next);
        }

        var sentCampaign = new Campaign(req.body);

        validateCampaign(sentCampaign, req.user.id, "POST", function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            sentCampaign.campaignLeads = [req.user.id];

            if (!_.contains(req.user.roles, auth.roles.campaignlead)) {
                req.user.roles.push(auth.roles.campaignlead);
            }

            // update user with his new role as campaign lead

            req.user.save(function (err) {
                if (err) {
                    return error.handleError(err, next);
                }
            });


            req.log.trace(sentCampaign, 'PostFn: Saving new Campaign object');

            // try to save the new campaign object
            sentCampaign.save(generic.writeObjCb(req, res, next));

        });

    };
};

function putCampaign(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated Campaign');

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'campaign object' }));
    }

    var sentCampaign = req.body;
    req.log.trace({body: sentCampaign}, 'parsed req body');

    handlerUtils.clean(Campaign, sentCampaign);

    Campaign.findById(req.params.id).exec(function (err, reloadedCampaign) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!reloadedCampaign) {
            return next(new error.ResourceNotFoundError({ id: sentCampaign.id}));
        }

        _.extend(reloadedCampaign, sentCampaign);

        validateCampaign(reloadedCampaign, req.user.id, "PUT", function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            req.log.trace(reloadedCampaign, 'PutFn: Updating existing Object');

            reloadedCampaign.save(generic.writeObjCb(req, res, next));
        });
    });

}


/**
 * lists all campaigns this user has access to.
 * set the query parameter "listall" to "true" to list all available campaigns in the system.
 *
 * @param baseUrl
 * @returns {Function}
 */
var getAllForUserFn = function (baseUrl) {
    return function (req, res, next) {

        var userId = req.user.id;

        var admin = auth.checkAccess(req.user, auth.accessLevels.al_admin);
        var listall = req.params.listall;
        var match = (admin || listall) ? {} : {campaignLeads: userId};

        var dbQuery = Campaign.find(match);
        generic.addStandardQueryOptions(req, dbQuery, Campaign)
            .exec(generic.writeObjCb(req, res, next));
    };
};

function _parseMailAdresses(stringToParse) {
    if (_.isArray(stringToParse)) {
        return stringToParse;
    } else if (stringToParse.indexOf(' ') !== -1) {
        return stringToParse.split(' ');
    } else if (stringToParse.indexOf(';') !== -1) {
        return stringToParse.split(';');
    } else if (stringToParse.indexOf(',') !== -1) {
        return stringToParse.split(',');
    } else {
        return [stringToParse];
    }

}

var postParticipantsInviteFn = function postParticipantsInviteFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({ required: 'email'}));
    }

    // split up the email field, in case we got more than one mail
    var emails = _parseMailAdresses(req.body.email);

    Campaign.findById(req.params.id)
        .populate('organization topic')
        .exec(function (err, campaign) {
            if (err) {
                return next(err);
            }
            if (!campaign) {
                return next(new error.ResourceNotFoundError({ campaignId: req.params.id }));
            }

            // check whether the posting user is a campaignLead of the campaign
            if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                return next(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                    userId: req.user.id,
                    campaignId: campaign.id
                }));
            }
            _.forEach(emails, function (emailaddress) {
                email.sendCampaignParticipantInvite(emailaddress, req.body.subject, req.body.text, req.user, campaign, req.i18n);
            });
        });

    res.send(200);
    return next();
};

var postCampaignLeadInviteFn = function postCampaignLeadInviteFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({ required: 'email'}));
    }

    // split up the email field, in case we got more than one mail
    var emails = _parseMailAdresses(req.body.email);

    var locals = {
    };
    async.series([
        // first load Campaign
        function (done) {
            Campaign.findById(req.params.id)
                .populate('organization topic')
                .exec(function (err, campaign) {
                    if (err) {
                        return done(err);
                    }
                    if (!campaign) {
                        return done(new error.ResourceNotFoundError({ campaignId: req.params.id }));
                    }

                    // check whether the posting user is a campaignLead of the campaign
                    if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                        return done(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                            userId: req.user.id,
                            campaignId: campaign.id
                        }));
                    }
                    locals.campaign = campaign;
                    return done();
                });
        },
        // for each email try whether we have a user in the Db with this email address and, if yes, load the user
        // to personalize the email then send the invitation mail
        // if we do not find a user for this email we send the same email but without personalization.
        function (done) {

            // collect known users for storing invitations
            var recipients = [];

            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUsers) {
                            if (err) {
                                return done(err);
                            }

                            if (invitedUsers && invitedUsers.length === 1) {
                                recipients.push(invitedUsers[0]);
                            } else {
                                recipients.push(emailaddress);
                            }

                            email.sendCampaignLeadInvite(emailaddress, req.user, locals.campaign, invitedUsers && invitedUsers[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    done();
                    SocialInteraction.emit('invitation:campaignLead', req.user, recipients, locals.campaign);
                });
        }
    ], function (err) {
        if (err) {
            return error.handleError(err, next);
        }
        res.send(200);
        return next();
    });
};

var assignCampaignLeadFn = function assignCampaignLeadFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.params.token) {
        return next(new error.MissingParameterError({ required: 'token' }));
    }
    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    var tokenElements;

    try {
        tokenElements = email.decryptLinkToken(req.params.token).split(config.linkTokenEncryption.separator);
    } catch (err) {
        return next(new error.InvalidArgumentError('Invalid token', {
            token: req.params.token
        }));
    }

    // tokenElements[0] must be the campaignId
    if (tokenElements[0] !== req.params.id) {
        return next(new error.InvalidArgumentError('Invalid token / campaignId', {
            token: req.params.token,
            campaignId: req.params.id
        }));
    }

    // tokenElements[1] should be the email-address that was invited
    if (tokenElements[1] !== req.user.email) {
        return next(new error.InvalidArgumentError('Invalid token / email', {
            token: req.params.token,
            email: req.user.email
        }));
    }

    // tokenElements[2], if it is defined should be the user id of the invited user
    if (tokenElements[2] && (tokenElements[2] !== req.user.id)) {
        return next(new error.InvalidArgumentError('Invalid token / userId', {
            token: req.params.token,
            userId: req.user.id
        }));
    }

    Campaign.findById(req.params.id)
        .exec(function (err, campaign) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!campaign) {
                return next(new error.ResourceNotFoundError('Campaign not found', { id: req.params.id }));
            }

            // we check whether we need to update the campaignLeads collection of the campaign
            if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                campaign.campaignLeads.push(req.user._id);
                campaign.save(function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                });
            }


            SocialInteraction.dismissInvitations(campaign, req.user, { reason: 'campaignleadAccepted' });
            res.send(200, campaign);

            // check whether we need to add the campaignLead role to the user
            if (!_.contains(req.user.roles, auth.roles.campaignlead)) {
                req.user.roles.push(auth.roles.campaignlead);
                req.user.save(function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    return next();
                });
            } else {
                return next();
            }

        });


};

var avatarImagePostFn = function (baseUrl) {
    return function (req, res, next) {

        image.resizeImage(req, req.files.file.path, 'campaign', function (err, image) {
            if (err) {
                return error.handleError(err, next);
            }

            getCampaign(req.params.id, function (err, obj) {
                if (err) {
                    return error.handleError(err, next);
                }

                obj.avatar = image;
                obj.save(function (err, result) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                });

                // send response
                res.send({avatar: obj.avatar});
                return next();
            });

        });
    };
};

module.exports = {
    getCampaignStats: getCampaignStats,
    postCampaign: postCampaign,
    putCampaign: putCampaign,
    getAllForUserFn: getAllForUserFn,
    assignCampaignLead: assignCampaignLeadFn,
    postCampaignLeadInvite: postCampaignLeadInviteFn,
    postParticipantsInvite: postParticipantsInviteFn,
    avatarImagePostFn: avatarImagePostFn
};