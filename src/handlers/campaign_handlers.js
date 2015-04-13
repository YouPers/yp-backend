var handlerUtils = require('ypbackendlib').handlerUtils,
    auth = require('ypbackendlib').auth,
    _ = require('lodash'),
    error = require('ypbackendlib').error,
    mongoose = require('ypbackendlib').mongoose,
    User = mongoose.model('User'),
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    Invitation = mongoose.model('Invitation'),
    Recommendation = mongoose.model('Recommendation'),
    PaymentCode = mongoose.model('PaymentCode'),
    Topic = mongoose.model('Topic'),
    Idea = mongoose.model('Idea'),
    ActivityManagement = require('../core/ActivityManagement'),
    crypto = require('crypto'),
    async = require('async'),
    email = require('../util/email'),
    image = require('ypbackendlib').image,
    moment = require('moment-timezone'),
    generic = require('ypbackendlib').handlers,
    config = require('../config/config'),
    restify = require('restify');

var getCampaign = function (id, cb) {

    Campaign.findById(id)
        .exec(function (err, obj) {
            if (err) {
                return error.handleError(err, cb);
            }
            if (!obj) {
                return cb(new error.ResourceNotFoundError('Campaign not found', {id: id}));
            }

            cb(null, obj);
        });
};

function _validateCampaign(campaign, user, type, done) {

    if (!campaign.organization) {
        Organization.findOne({administrators: user.id}).exec(function (err, organization) {
            if (err) {
                return done(err);
            }
            campaign.organization = organization;
            validate();
        });
    } else {
        validate();
    }

    function validate() {

        campaign.validate(function (err) {
            if (err) {
                return done(err);
            }

            Organization.findById(campaign.organization).exec(function (err, organization) {
                if (err) {
                    return done(err);
                }

                var isOrganizationAdmin = _.contains(user.roles, 'orgadmin') && _.contains(organization.administrators.toString(), user.id);
                var isCampaignLead = _.contains(user.roles, 'campaignlead') && _.contains(campaign.campaignLeads.toString(), user.id);

                if (type === "PUT") {

                    if (!isOrganizationAdmin && !isCampaignLead) {
                        return done(new error.NotAuthorizedError('Not authorized to create a campaign, the user is neither ' +
                        'orgadmin of the organization nor a campaignlead of the campaign.', {
                            campaignId: campaign.id,
                            organizationId: organization.id,
                            userId: user.id
                        }));
                    }
                } else {

                    if (!isOrganizationAdmin && !isCampaignLead) {
                        return done(new error.NotAuthorizedError('Not authorized to create a campaign, not an orgadmin.', {
                            organizationId: organization.id,
                            userId: user.id
                        }));
                    }
                }

                return done();
            });
        });
    }
}

var postCampaign = function (baseUrl) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, Campaign);

        if (err) {
            return error.handleError(err, next);
        }

        var paymentCode = req.body.paymentCode;
        if (!paymentCode && config.paymentCodeChecking === 'enabled') {
            return error.handleError(new error.MissingParameterError({required: 'paymentCode'}, "need a paymentCode to create a campaign"), next);
        } else if (!paymentCode && config.paymentCodeChecking === 'disabled') {
            paymentCode = {code: "testcode"};
        }
        var sentCampaign = new Campaign(req.body);

        _validateCampaign(sentCampaign, req.user, "POST", function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            PaymentCode.find({code: paymentCode.code || paymentCode}).populate('marketPartner').exec(function (err, loadedCodes) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (config.paymentCodeChecking !== 'disabled') {
                    if (!loadedCodes || loadedCodes.length !== 1) {
                        return error.handleError(new error.InvalidArgumentError({code: paymentCode}, 'invalid code'), next);
                    }
                }
                var code = loadedCodes[0];
                if (code) {
                    sentCampaign.marketPartner = code.marketPartner && code.marketPartner.id;
                    sentCampaign.endorsementType = code.endorsementType;
                }

                // create and set the ObjectId of the new campaign manually before saving, because we need
                // it to send the campaign lead invitations for newCampaignLeads
                // use campaignId from request parameters if defined
                sentCampaign._id = new mongoose.Types.ObjectId(req.params.campaignId || undefined);

                createNewCampaignLeadUsers(sentCampaign, req, function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }

                    Campaign.populate(sentCampaign, {
                        path: 'campaignLeads',
                        select: '+username'
                    }, function (err, campaign) {
                        if (err) {
                            return error.handleError(err, next);
                        }

                        if (req.params.defaultCampaignLead) { // move to front
                            var campaignLead = _.remove(campaign.campaignLeads, 'username', req.params.defaultCampaignLead);
                            if (campaignLead.length > 0) {
                                campaign.campaignLeads.unshift(campaignLead[0]);
                            }
                        }

                        // check whether we have minimum 1 campaignlead, if not, make the current user a campaignlead
                        if (campaign.campaignLeads.length === 0) {
                            campaign.campaignLeads.push(req.user._id);
                        }

                        // try to save the new campaign object
                        campaign.save(function (err, savedCampaign) {
                            if (err) {
                                return error.handleError(err, next);
                            }

                            // set the campaign attribute on all existing campaign leads,
                            // the campaign has to be already saved, in order to have the resulting change:campaign listener work properly
                            async.forEach(savedCampaign.campaignLeads, function (cl, done) {
                                User.findById(cl._id || cl).select(User.privatePropertiesSelector).exec(function (err, user) {
                                    if (err) {
                                        return done(err);
                                    }
                                    user.campaign = savedCampaign._id;
                                    if (!_.contains(user.roles, 'campaignlead')) {
                                        user.roles.push('campaignlead');
                                    }
                                    user.save(done);
                                });
                            }, function (err) {
                                if (err) {
                                    return next(err);
                                }
                                // don't do anything as we do this async
                            });

                            if (code) {
                                code.campaign = savedCampaign._id;
                                code.save();
                            }

                            createTemplateCampaignOffers(savedCampaign, savedCampaign.campaignLeads[0], req, function (err) {
                                if (err) {
                                    return error.handleError(err, next);
                                }

                                // the campaign has been saved and all template offer have been generated
                                // talking to SurveyMonkey API often takes a few seconds, to avoid
                                // timeouting our response we do the SurveyMonkey API Call async after we
                                // signal success to the browser
                                req.log.debug({"surveyMonkeyEnabled": config.surveyMonkey && config.surveyMonkey.enabled === "enabled"}, "surveyMonkeyConfig enabled?");
                                if (config.surveyMonkey && config.surveyMonkey.enabled === "enabled") {
                                    addSurveyCollectors(savedCampaign, req, function (err) {
                                        if (err) {
                                            req.log.error(err, "error while talking asynchronously to SurveyMonkey.");
                                        }
                                        savedCampaign.save(function (err, savedAgain) {
                                            if (err) {
                                                req.log.error(err, "error while saving the SurveyUrls on the campaign");
                                            }
                                        });

                                    });
                                }
                                return generic.writeObjCb(req, res, next)(err, savedCampaign);
                            });

                        });
                    });

                });

            });
        });
    };
};

function createNewCampaignLeadUsers(campaign, req, done) {

    async.each(campaign.newCampaignLeads, function (campaignLead, cb) {

        // random password
        crypto.randomBytes(16, function (err, random) {
            if (err) {
                return cb(err);
            }

            campaignLead.password = random;
            campaignLead.tempPasswordFlag = true; // used to determine the campaign lead invite url
            campaignLead.roles = ['individual', 'campaignlead'];

            var user = new User(campaignLead);
            user.save(req, function (err, savedUser) {
                if (err) {
                    return cb(err);
                }

                campaign.campaignLeads.push(savedUser._id);

                Topic.populate(campaign, {path: 'topic'}, function (err, campaign) {
                    if (err) {
                        return cb(err);
                    }
                    email.sendCampaignLeadInvite(campaignLead.email, req.user, campaign, savedUser, req.i18n);
                    cb(null, savedUser);
                });
            });
        });

    }, function (err) {
        if (err) {
            return done(err);
        }
        campaign.newCampaignLeads = [];
        done();
    });
}

function createTemplateCampaignOffers(campaign, user, req, cb) {

    Topic.findById(campaign.topic, function (err, topic) {
        if (err) {
            cb(err);
        }

        User.findById(user._id || user).select('+profile +email').populate('profile').exec(function (err, user) {
            async.each(topic.templateCampaignOffers, function (offer, done) {

                var day = moment(campaign.start).tz('Europe/Zurich').add(offer.week, 'weeks').day(offer.weekday);

                // TODO: use proper timezone of the user here
                var startOfDay = moment(day).tz('Europe/Zurich').startOf('day');
                var endOfDay = moment(day).tz('Europe/Zurich').endOf('day');

                // check if campaign is still running for this day
                if (startOfDay.isAfter(campaign.end) || startOfDay.isBefore(campaign.start)) {
                    return done();
                }

                if (offer.type === 'Recommendation') {

                    var recommendation = new Recommendation({
                        idea: offer.idea,

                        author: user,
                        authorType: 'campaignLead',

                        targetSpaces: [{
                            type: 'campaign',
                            targetId: campaign._id
                        }],

                        publishFrom: startOfDay.toDate(),
                        publishTo: endOfDay.toDate(),
                        __t: "Recommendation"
                    });

                    recommendation.save(function (err, saved) {
                        if (err) {
                            done(err);
                        }
                        done();
                    });

                } else if (offer.type === 'Invitation') {

                    Idea.findById(offer.idea, function (err, idea) {
                        if (err) {
                            done(err);
                        }

                        var defaultActivity = ActivityManagement.defaultActivity(idea, user, campaign._id, day);
                        ActivityManagement.saveNewActivity(defaultActivity, user, req.i18n,
                            function (err, saved) {

                                var publishFrom = moment(saved.start).subtract(2, 'days').tz('Europe/Zurich').startOf('day').toDate();
                                if (moment(publishFrom).isBefore(moment(campaign.start))) {
                                    publishFrom = campaign.start;
                                }
                                var publishTo = saved.start;

                                var invitation = new Invitation({
                                    activity: saved._id,
                                    idea: idea._id,
                                    author: user,
                                    authorType: 'campaignLead',

                                    targetSpaces: [{
                                        type: 'campaign',
                                        targetId: campaign._id
                                    }],

                                    publishFrom: publishFrom,
                                    publishTo: publishTo,
                                    __t: "Invitation"
                                });

                                invitation.save(function (err, saved) {
                                    if (err) {
                                        done(err);
                                    }
                                    done();
                                });
                            });
                    });

                } else {
                    return done('unsupported templateCampaignOffer.type: ' + offer.type);
                }

            }, function (err) {
                if (err) {
                    cb(err);
                }
                cb();
            });
        });
    });
}

function addSurveyCollectors(campaign, req, cb) {


    var jsonClient = restify.createJsonClient({
        url: config.surveyMonkey.apiUrl,
        version: '*',
        log: req.log,
        headers: {
            Authorization: "Bearer " + config.surveyMonkey.AccessToken
        }
    });


    mongoose.model('Organization').findById(campaign.organization).exec(function (err, org) {
        if (err) {
            error.handleError(err, cb);
        }

        var body = {
            survey_id: config.surveyMonkey.dcmSurveyId[req.locale],
            collector: {
                type: 'weblink',
                name: org.name + '/ ' + campaign.participants + '/' + campaign.location
            }
        };

        jsonClient.post(config.surveyMonkey.createCollectorEndpoint + '?api_key=' + config.surveyMonkey.api_key,
            body,
            function (err, request, response, obj) {
                if (err || obj.status !== 0) {
                    req.log.error({
                        path: request.path,
                        method: request.method,
                        headers: request._headers
                    }, 'ERROR posting to SurveyMonkey: request');
                    req.log.error({res: response}, 'ERROR posting to SurveyMonkey: response');
                    return cb(err || new Error("error creating surveyMonkey collector:" + obj.status));
                }

                campaign.leaderSurveyCollectorId = obj && obj.data && obj.data.collector.collector_id;
                campaign.leaderSurveyUrl = obj && obj.data && obj.data.collector.url;

                body.survey_id = config.surveyMonkey.dhcSurveyId[req.locale];

                jsonClient.post(config.surveyMonkey.createCollectorEndpoint + '?api_key=' + config.surveyMonkey.api_key,
                    body,
                    function (err, request, response, respObj) {
                        if (err || respObj.status !== 0) {
                            req.log.error({
                                path: request.path,
                                method: request.method,
                                headers: request._headers
                            }, 'ERROR posting to SurveyMonkey: request');
                            req.log.error({res: response}, 'ERROR posting to SurveyMonkey: response');
                            return cb(err || new Error("error creating surveyMonkey collector:" + obj.status));
                        }

                        campaign.participantSurveyCollectorId = respObj && respObj.data && respObj.data.collector.collector_id;
                        campaign.participantSurveyUrl = respObj && respObj.data && respObj.data.collector.url;


                        return cb(null, campaign);
                    });
            });


    });
}

function putCampaign(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated Campaign');

    if (!req.body) {
        return next(new error.MissingParameterError({required: 'campaign object'}));
    }

    var sentCampaign = req.body;
    req.log.trace({body: sentCampaign}, 'parsed req body');

    handlerUtils.clean(Campaign, sentCampaign);

    Campaign.findById(req.params.id).exec(function (err, reloadedCampaign) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!reloadedCampaign) {
            return next(new error.ResourceNotFoundError({id: sentCampaign.id}));
        }

        _.extend(reloadedCampaign, sentCampaign);

        _validateCampaign(reloadedCampaign, req.user, "PUT", function (err) {
            if (err) {
                return error.handleError(err, next);
            }
            createNewCampaignLeadUsers(reloadedCampaign, req, function (err) {
                if (err) {
                    return error.handleError(err, next);
                }
                req.log.trace(reloadedCampaign, 'PutFn: Updating existing Object');
                reloadedCampaign.save(generic.writeObjCb(req, res, next));
            });
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

        Organization.find({administrators: userId}).select('_id').exec(function (err, organizations) {

            var admin = auth.checkAccess(req.user, auth.accessLevels.al_admin);
            var listall = req.params.listall;
            var match = (admin || listall) ? {} :
            {
                $or: [
                    {campaignLeads: userId},
                    {organization: {$in: organizations}}
                ]
            };

            var dbQuery = Campaign.find(match);
            generic.addStandardQueryOptions(req, dbQuery, Campaign)
                .exec(function (err, campaigns) {
                    User.populate(campaigns, {
                        path: 'campaignLeads',
                        select: '+emailValidatedFlag'
                    }, function (err, campaigns) {
                        generic.sendListCb(req, res, next)(err, campaigns);
                    });
                });

        });

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
        return next(new error.MissingParameterError({required: 'id'}));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({required: 'email'}));
    }

    // split up the email field, in case we got more than one mail
    var emails = _parseMailAdresses(req.body.email);

    Campaign.findById(req.params.id)
        .populate('organization topic campaignLeads')
        .exec(function (err, campaign) {
            if (err) {
                return next(err);
            }
            if (!campaign) {
                return next(new error.ResourceNotFoundError({campaignId: req.params.id}));
            }

            // check whether the posting user is a campaignLead of the campaign
            if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                return next(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                    userId: req.user.id,
                    campaignId: campaign.id
                }));
            }
            _.forEach(emails, function (emailaddress) {
                email.sendCampaignParticipantInvite(emailaddress, req.user, campaign, req.body.testOnly, req.i18n);
            });
        });

    res.send(200);
    return next();
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

var deleteByIdFn = function deleteByIdFn(baseUrl, Model) {
    return function (req, res, next) {
        var objId;
        try {
            objId = new mongoose.Types.ObjectId(req.params.id);
        } catch (err) {
            return next(new error.InvalidArgumentError({id: req.params.id}));
        }
        // instead of using Model.remove directly, findOne in combination with obj.remove
        // is used in order to trigger
        // - schema.pre('remove', ... or
        // - schema.pre('remove', ...
        // see user_model.js for an example

        // check if this is a "personal" object (i.e. has an "owner" property),
        // if yes only delete the objects of the currently logged in user
        var finder = {_id: req.params.id};

        if (!req.user || !req.user.id) {
            return next(new error.NotAuthorizedError('Authentication required for this object'));
        }

        Model.findOne(finder).populate('organization').exec(function (err, campaign) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!campaign) {
                req.log.error(finder);
                return next(new error.ResourceNotFoundError());
            }
            var isSysadmin = auth.checkAccess(req.user, 'al_systemadmin');
            var isCampaignLead = _.find(campaign.campaignLeads, function (user) {
                return user.equals(req.user._id);
            });

            var isOrgAdmin = _.find(campaign.organization.administrators, function(adm) {
                return adm.equals(req.user._id);
            });

            if (!isSysadmin && !isCampaignLead && !isOrgAdmin) {
                return next(new error.NotAuthorizedError('Not authorized to delete this campaign, must have role campaignlead or sysadmin.'));
            }

            // check whether there are users in the campaign
            mongoose.model('User').find({campaign: campaign._id}).count(function (err, count) {
                if (err) {
                    return error.handleError(err, next);
                }

                if (count > campaign.campaignLeads.length && !isSysadmin) {
                    return next(new error.NotAuthorizedError('Cannot delete this campaign, ' + count + ' users have already joined.'));
                }

                campaign.remove(function (err) {

                    // update the paymentcode if there is one that belonged to this campaign:
                    PaymentCode.find({campaign: req.params.id}).exec(function (err, codes) {
                        if (err) {
                            error.handleError(err, next);
                        }
                        if (codes && codes.length >0) {
                            codes[0].campaign = undefined;
                            codes[0].save(function (err, saved) {
                                res.send({code: codes[0].code});
                                return next();
                            });
                        } else {
                            res.send(200);
                            return next();
                        }
                    });
                });
            });

        });
    };
};

var postCampaignLeadInviteFn = function postCampaignLeadInviteFn(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({required: 'id'}));
    }
    if (!req.body || !req.body.campaignLeadId) {
        return next(new error.MissingParameterError({required: 'campaignLeadId'}));
    }

    Campaign.findById(req.params.id)
        .populate('organization topic campaignLeads')
        .exec(function (err, campaign) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!campaign) {
                return next(new error.ResourceNotFoundError({campaignId: req.params.id}));
            }

            // check whether the posting user is a orgadmin of the campaigns organization
            if (!_.contains(campaign.organization.administrators.toString(), req.user.id)) {
                return next(new error.NotAuthorizedError('The user is not a orgadmin for this campaign.', {
                    userId: req.user.id,
                    campaignId: campaign.id
                }));
            }

            User.findById(req.body.campaignLeadId).select('+email +username').exec(function (err, cl) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (!cl) {
                    return next(new error.InvalidArgumentError("campaignlead not found"));
                }
                if (!_.contains(campaign.campaignLeads.toString(), req.body.campaignLeadId)) {
                    return next(new error.InvalidArgumentError("this campaignleadId is not valid for this campaign"));
                }
                email.sendCampaignLeadInvite(cl.email, req.user, campaign, cl, req.i18n);
                res.send(200);
                return next();
            });
        });
};

module.exports = {
    postCampaign: postCampaign,
    putCampaign: putCampaign,
    deleteByIdFn: deleteByIdFn,
    getAllForUserFn: getAllForUserFn,
    postParticipantsInvite: postParticipantsInviteFn,
    postCampaignLeadInvite: postCampaignLeadInviteFn,
    avatarImagePostFn: avatarImagePostFn
};