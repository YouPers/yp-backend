var error = require('ypbackendlib').error,
    handlerUtils = require('ypbackendlib').handlerUtils,
    auth = require('ypbackendlib').auth,
    mongoose = require('ypbackendlib').mongoose,
    Organization = mongoose.model('Organization'),
    Campaign = mongoose.model('Campaign'),
    _ = require('lodash'),
    generic = require('ypbackendlib').handlers;

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

                // try to save the new organization object
                obj.save(generic.writeObjCb(req, res, next));
            });
        } else {

            // try to save the new organization object
            obj.save(generic.writeObjCb(req, res, next));
        }

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

module.exports = {
    postFn: postFn,
    getAllForUserFn: getAllForUserFn
};