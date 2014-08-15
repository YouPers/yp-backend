var error = require('../util/error'),
    generic = require('./../handlers/generic'),
    mongoose = require('mongoose'),
    auth = require('../util/auth'),
    SocialInteraction = require('../core/SocialInteraction'),
    SocialInteractionModel = mongoose.model('SocialInteraction');

var getByIdFn = function getByIdFn(baseUrl, Model) {
    return function getById(req, res, next) {

        Model.findById(req.params.id).populate('author').exec(function(err, socialInteraction) {

            if (err) {
                return error.handleError(err, next);
            }
            if (!socialInteraction) {
                return next(new error.ResourceNotFoundError());
            }
// methods are not accessible for discriminators, see https://github.com/LearnBoost/mongoose/issues/2167
//            if(socialInteraction.isTargeted && !socialInteraction.isTargeted(user)) {
//                return next(new error.NotAuthorizedError());
//            }

            SocialInteraction.populateSocialInteraction(socialInteraction, null, function(err, populated) {
                res.send(populated);
                return next();
            });

        });
    };
};

var getAllFn = function getAllFn(baseUrl, Model) {
    return function getAll(req, res, next) {

        var user = req.user;
        var isAdminMode = auth.checkAccess(req.user, auth.accessLevels.al_admin) &&
            req.params.mode && req.params.mode === 'administrate';
        var isCampaignLeadMode = auth.checkAccess(req.user, auth.accessLevels.al_campaignlead) &&
            req.params.campaign;
        var options = {
            mode: isAdminMode ? 'admin' : (isCampaignLeadMode ? 'campaignlead' : 'user'),
            campaignId: req.params.campaign,
            refDocId: req.params.refDocId,
            queryOptions: req.query,
            locale: req.locale,
            populateRefDocs: true
        };

        SocialInteraction.getAllForUser(user, Model, options, generic.sendListCb(req, res, next));
    };
};


var deleteByIdFn = function (baseUrl, Model) {
    return function deleteByIdFn (req, res, next) {

        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({ required: 'id' }));
        }

        Model.findById(req.params.id).exec(function(err, socialInteraction) {

            if (err) {
                return error.handleError(err, next);
            }

            if (!socialInteraction) {
                // the soi we wanted to delete does not exist -->
                res.send(200);
                return next();
            }
            // the author may delete his own socialInteraction,
            // system admins can delete any socialInteraction, with the 'administrate' flag set
            var adminMode = auth.checkAccess(req.user, 'al_admin') &&
                req.params.mode && req.params.mode === 'administrate';
            if (req.user._id.equals(socialInteraction.author) || adminMode
                ) {
                return generic.deleteByIdFn(baseUrl, SocialInteractionModel)(req, res, next);
            }

            // TODO: add check for Model
            SocialInteraction.dismissSocialInteractionById(req.params.id, req.user, function(err, socialInteraction) {
                if(err) {
                    return error.handleError(err, next);
                }
                res.send(200);
                return next();
            });

        });

    };
};

module.exports = {
    deleteByIdFn: deleteByIdFn,
    getByIdFn: getByIdFn,
    getAllFn: getAllFn
};