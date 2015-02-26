var error = require('ypbackendlib').error,
    generic = require('ypbackendlib').handlers,
    mongoose = require('ypbackendlib').mongoose,
    auth = require('ypbackendlib').auth,
    moment = require('moment'),
    SocialInteraction = require('../core/SocialInteraction'),
    Inspiration = require('../core/Inspiration'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    CoachRecommendation = require('../core/CoachRecommendation');

var getByIdFn = function getByIdFn(baseUrl, Model) {
    return function getById(req, res, next) {
        return SocialInteraction.getById(req.params.id, Model, req.query, req.locale, generic.writeObjCb(req, res, next));
    };
};

var getAllFn = function getAllFn(baseUrl, Model) {
    return function getAll(req, res, next) {

        var user = req.user;
        var isAdminMode = auth.checkAccess(req.user, auth.accessLevels.al_admin) &&
            req.params.mode && req.params.mode === 'administrate';

        // use for date filter if it is a valid date
        // enable or disable date filter if it is a boolean value or not defined
        function parsePublishDate(parameterName) {
            var parameter = req.params[parameterName];
            if(parameter) {
                var date = moment(parameter);
                if(date.isValid()) {
                    return date;
                } else {
                    return parameter !== 'false';
                }
            } else {
                return true;
            }
        }

        var publishFrom = parsePublishDate('publishFrom');
        var publishTo = parsePublishDate('publishTo');

        var options = {
            mode: isAdminMode ? 'admin' : 'default', // admin mode ignores all filter options except the generic query options

            targetId: req.params.targetId, // disables the default target space filter, use case: comments targeted to a campaign or activity
            refDocId: req.params.refDocId, // disables the default target space filter, use case: participants/invitees of an activity


            // inclusive filter options: includes results that would be filtered out with the default filter options

            dismissed: Boolean(req.params.dismissed), // include dismissed social interactions
            dismissalReason: req.params.dismissalReason, // the reason a social interaction has been dismissed
            rejected: Boolean(req.params.rejected), // include social interactions referencing ideas the user has rejected
            authored: Boolean(req.params.authored), // include social interactions where the user is the author

            publishFrom: publishFrom,
            publishTo: publishTo,

            authorType: req.params.authorType, // if the socialInteraction was posted as user, campaignLead, ...
            // comma separated list of Model names, values: Message, Recommendation or Invitation
            discriminators: req.params.discriminators && req.params.discriminators.split(','),
            queryOptions: req.query,
            locale: req.locale,
            populateRefDocs: true
        };

        SocialInteraction.getAllForUser(user, Model, options, generic.sendListCb(req, res, next));
    };
};
var getInspirations = function getAll(req, res, next) {

    var user = req.user;

    var options = {

        discriminators: ['Recommendation', 'Invitation'],

        queryOptions: req.query,
        locale: req.locale,
        populateRefDocs: true,
        publishFrom: true,
        publishTo: true
    };

    CoachRecommendation.generateAndStoreRecommendations(req.user.id, {}, function(err, recs) {
        SocialInteraction.getAllForUser(user, SocialInteractionModel, options, generic.sendListCb(req, res, next));
    });
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

            SocialInteraction.dismissSocialInteractionById(req.params.id, req.user, { reason: req.params.reason }, function(err, socialInteraction) {
                if(err) {
                    return error.handleError(err, next);
                }
                res.send(200);
                return next();
            });

        });

    };
};

var getInspirationsNew = function(req, res, next) {
    Inspiration.getInspirations(req.user, req.query, generic.sendListCb(req, res, next));
};

module.exports = {
    deleteByIdFn: deleteByIdFn,
    getByIdFn: getByIdFn,
    getAllFn: getAllFn,
    getInspirations: getInspirations,
    getInspirationsNew: getInspirationsNew
};