var error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth'),
    image = require('../util/image'),
    mongoose = require('mongoose'),
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    SocialInteraction = require('../core/SocialInteraction'),
    email = require('../util/email'),
    async = require('async'),
    _ = require('lodash'),
    generic = require('./generic');


var getOrganization = function (req, res, next, callback) {

    Organization.findById(req.params.id)
        .exec(function (err, org) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!org) {
                return next(new error.ResourceNotFoundError('Organization not found', { id: req.params.id }));
            }

            callback(org);
        });
};

var postFn = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, Organization);

        if (err) {
            return error.handleError(err, next);
        }

        var obj = new Organization(req.body);

        obj.administrators = [req.user.id];

        if (!_.contains(req.user.roles, auth.roles.orgadmin)) {
            req.user.roles.push(auth.roles.orgadmin);
            req.user.save(function (err) {
                if (err) {
                    return error.handleError(err, next);
                }
            });
        }

        // try to save the new organization object
        obj.save(generic.writeObjCb(req, res, next));

    };
};

/**
 * A org-Admin may see his organisation
 * A CampaignLead may see the organisation where he has campaigns in.
 *
 * @param req
 * @param res
 * @param next
 */
var getAllForUserFn = function (req, res, next) {
   var userId = req.user.id;

    Campaign.find({campaignLeads: userId}).exec(function (err, campaigns) {
        var orgs = _.map(campaigns, 'organization');

        Organization.find().populate('administrators').or([
            {administrators: userId},
            {_id: {$in: orgs}}
        ])
            .exec(generic.sendListCb(req, res, next));
    });


};


var postOrganizationAdminInviteFn = function postOrganizationAdminInviteFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({ required: 'email'}));
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
        // first load Organization
        function (done) {
            Organization.findById(req.params.id)
                .exec(function (err, organization) {
                    if (err) {
                        return done(err);
                    }
                    if (!organization) {
                        return done(new error.ResourceNotFoundError({ campaignId: req.params.id }));
                    }

                    // check whether the posting user is a campaignLead of the organization
                    if (!_.contains(organization.administrators.toString(), req.user.id)) {
                        return done(new error.NotAuthorizedError('The user is not a orgadmin of this organization.', {
                            userId: req.user.id,
                            organizationId: organization.id
                        }));
                    }
                    locals.organization = organization;
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

                            if (invitedUser && invitedUser.length === 1) {
                                SocialInteraction.emit('invitation:organizationAdmin', req.user, invitedUser[0], locals.organization);
                            }

                            email.sendOrganizationAdminInvite(emailaddress, req.user, locals.organization, invitedUser && invitedUser[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    done();
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

var assignOrganizationAdminFn = function assignOrganizationAdminFn(req, res, next) {
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
        tokenElements = email.decryptLinkToken(req.params.token).split(email.linkTokenSeparator);
    } catch (err) {
        return next(new error.InvalidArgumentError('Invalid token', {
            token: req.params.token
        }));
    }

    // tokenElements[0] must be the organizationId
    if (tokenElements[0] !== req.params.id) {
        return next(new error.InvalidArgumentError('Invalid token / organizationId', {
            token: req.params.token,
            organizationId: req.params.id
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

    Organization.findById(req.params.id)
        .exec(function (err, organization) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!organization) {
                return next(new error.ResourceNotFoundError('Organization not found', { id: req.params.id }));
            }

            // we check whether we need to update the administrators collection of the organization
            if (!_.contains(organization.administrators.toString(), req.user.id)) {
                organization.administrators.push(req.user._id);
                organization.save(function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                });
            }

            // check whether we need to add the orgadmin role to the user
            if (!_.contains(req.user.roles, auth.roles.orgadmin)) {
                req.user.roles.push(auth.roles.orgadmin);
                req.user.save(function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                });
            }

            SocialInteraction.dismissInvitations(organization, req.user);

            res.send(200, organization);
            return next();
        });


};

var avatarImagePostFn = function (baseUrl) {
    return function (req, res, next) {

        image.resizeImage(req, req.files.file.path, 'organization', function (err, image) {
            if (err) {
                return error.handleError(err, next);
            }

            getOrganization(req, res, next, function (org) {

                org.avatar = image;
                org.save(function (err, savedOrg) {
                    if (err) {
                        return error.handleError(err, next);
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
    postOrganizationAdminInviteFn: postOrganizationAdminInviteFn,
    assignOrganizationAdminFn: assignOrganizationAdminFn,
    avatarImagePostFn: avatarImagePostFn
};