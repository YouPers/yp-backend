var error = require('../util/error'),
    generic = require('./../handlers/generic'),
    mongoose = require('mongoose'),
    moment = require('moment'),
    auth = require('../util/auth'),
    SocialInteraction = mongoose.model('SocialInteraction'),
    SocialInteractionDismissed = mongoose.model('SocialInteractionDismissed'),
    _ = require('lodash');

var getAllFn = function getAllFn(baseUrl, Model, fromAllOwners) {
    return function getAll(req, res, next) {

        var user = req.user;

        SocialInteractionDismissed.find({ user: user.id }, function(err, sid) {

            if(err) {
                return error.handleError(err, next);
            }

            var dismissedSocialInteractions = _.map(sid, 'socialInteraction');
            var now = moment().toDate();

            var finder = {
                targetSpaces: { $elemMatch: { targetId: user._id, targetModel: 'User' }}
//                // TODO: add targetSpaces for campaign/activity/system
            };

            var dbQuery = Model.find(finder)
                .and({_id: { $nin: dismissedSocialInteractions }})
                .and({$or: [{publishTo: {$exists: false}}, {publishTo: {$gte: now}}]})
                .and({$or: [{publishFrom: {$exists: false}}, {publishFrom: {$lte: now}}]});

            //generic.addStandardQueryOptions(req, dbQuery, Model)
            dbQuery.exec(generic.sendListCb(req, res, next));
        });
    };

};


var dismissSocialInteraction = function dismissSocialInteraction(socialInteractionId, user, cb) {


    SocialInteraction.findById(socialInteractionId, function(err, socialInteraction) {

        if(err) {
            cb(err);
        }

        var userId = (user._id ? user._id : user);

        // just delete the socialInteraction if the only targeted space is the user
        if(!_.any(socialInteraction.targetSpaces, function(space) {
            return space.targetModel !== 'User';
        })) {
            return socialInteraction.remove(cb);
        }

        var socialInteractionDismissed = new SocialInteractionDismissed({
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });

        return socialInteractionDismissed.save(function(err) {
            // we deliberately want to ignore DuplicateKey Errors, becuause there is not reason to store the dissmissals more than once
            // MONGO Duplicate KeyError code: 11000
            if (err && err.code !== 11000) {
                return cb(err);
            }
            return cb();
        });

    });

};

var deleteByIdFn = function (baseUrl, Model) {
    return function deleteByIdFn (req, res, next) {

        if (!req.params || !req.params.id) {
            return next(new error.MissingParameterError({ required: 'id' }));
        }

        // system admins can delete any socialInteraction, with the 'administrate' flag set
        if (auth.checkAccess(req.user, 'al_systemadmin') &&
            req.params.mode && req.params.mode === 'administrate') {
            return generic.deleteByIdFn(baseUrl, SocialInteraction)(req, res, next);
        }

        // TODO: add check for Model
        dismissSocialInteraction(req.params.id, req.user, function(err, socialInteraction) {
            if(err) {
                return error.handleError(err, next);
            }
            res.send(200);
            return next();
        });
    };
};

module.exports = {
    dismissSocialInteraction: dismissSocialInteraction,
    deleteByIdFn: deleteByIdFn,
    getAllFn: getAllFn
};