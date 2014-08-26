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

        var options = {
            mode: isAdminMode ? 'admin' : 'default', // admin mode ignores all filter options except the generic query options

            dismissed: Boolean(req.params.dismissed), // include dismissed social interactions
            rejected: Boolean(req.params.rejected), // include social interactions referencing ideas the user has rejected
            authored: Boolean(req.params.authored), // include social interactions where the user is the author

            targetId: req.params.targetId, // disables the default target space filter
            authorType: req.params.authorType,

            // comma separated list of Model names, values: Message, Recommendation or Invitation
            discriminators: req.params.discriminators && req.params.discriminators.split(','),
            refDocId: req.params.refDocId, // used for idea context
            queryOptions: req.query,
            locale: req.locale,
            populateRefDocs: true
        };

        SocialInteraction.getAllForUser(user, Model, options, generic.sendListCb(req, res, next));
    };
};
var getOffers = function getAll(req, res, next) {

    var user = req.user;

    var options = {

        dismissed: true,
        rejected: true,

        discriminators: ['Recommendation', 'Invitation'],

        queryOptions: req.query,
        locale: req.locale,
        populateRefDocs: true
    };

    SocialInteraction.getAllForUser(user, SocialInteractionModel, options, generic.sendListCb(req, res, next));
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
    getAllFn: getAllFn,
    getOffers: getOffers
};