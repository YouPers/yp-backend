var error = require('../util/error'),
    generic = require('./../handlers/generic'),
    mongoose = require('mongoose'),
    moment = require('moment'),
    auth = require('../util/auth'),
    SocialInteraction = require('../core/SocialInteraction'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    _ = require('lodash');

var getAllFn = function getAllFn(baseUrl, Model, fromAllOwners) {
    return function getAll(req, res, next) {

        var user = req.user;

        SocialInteractionDismissedModel.find({ user: user.id }, function(err, sid) {

            if(err) {
                return error.handleError(err, next);
            }

            var dismissedSocialInteractions = _.map(sid, 'socialInteraction');
            var now = moment().toDate();

            var finder = {
                targetSpaces: { $elemMatch: {
                    $or: [
                        { type: 'user', targetId: user._id, targetModel: 'User' },
                        { type: 'campaign', targetId: user.campaign, targetModel: 'Campaign' }
                    ]
                }}
//                // TODO: add targetSpaces for activity/system
            };

            var dbQuery = Model.find(finder)
                .and({_id: { $nin: dismissedSocialInteractions }})
                .and({$or: [{publishTo: {$exists: false}}, {publishTo: {$gte: now}}]})
                .and({$or: [{publishFrom: {$exists: false}}, {publishFrom: {$lte: now}}]});

            generic.addStandardQueryOptions(req, dbQuery, Model)
                .exec(generic.sendListCb(req, res, next));
        });
    };

};



var deleteByIdFn = function (baseUrl, Model) {
    return function deleteByIdFn (req, res, next) {

        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({ required: 'id' }));
        }

        // system admins can delete any socialInteraction, with the 'administrate' flag set
        if (auth.checkAccess(req.user, 'al_systemadmin') &&
            req.params.mode && req.params.mode === 'administrate') {
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
    };
};

module.exports = {
    deleteByIdFn: deleteByIdFn,
    getAllFn: getAllFn
};