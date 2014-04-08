
var error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    auth = require('../util/auth'),
    mongoose = require('mongoose');

var getNewestResult = function (baseUrl, Model) {
    return function (req, res, next) {
        Model.find({assessment: req.params.assId, owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, result) {
                if(err) {
                    return error.handleError(err, next);
                }
                if (!result || result.length === 0){
                    res.send(204);
                    return next();
                }
                res.send(result[0]);
                return next();
            });
    };
};



function assessmentResultPostFn (baseUrl, Model) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req.body, req.user, Model);

        if (err) {
            return error.handleError(err, next);
        }

        // if this Model has a campaign Attribute and the user is currently part of a campaign,
        // we set the campaign on this object --> by default new objects are part of a campaign
        if (req.user && req.user.campaign && Model.schema.paths['campaign']) {
            req.body.campaign = req.user.campaign.id || req.user.campaign; // handle populated and unpopulated case
        }

        var newObj = new Model(req.body);

        req.log.trace(newObj, 'PostFn: Saving new Object');
        // try to save the new object
        newObj.save(function (err, savedObj) {
            if(err) {
                return error.handleError(err, next);
            }
            // TODO: pass the users current goals
            CoachRecommendation.generateAndStoreRecommendations(req.user._id, req.user.profile.userPreferences.rejectedActivities, savedObj, null, auth.isAdminForModel(req.user, mongoose.model('Activity')), function(err, recs) {
                if (err) {
                    return error.handleError(err, next);
                }
                res.header('location', req.url + '/' + savedObj._id);
                res.send(201, savedObj);
                return next();
            });
        });
    };
}



module.exports = {
    getNewestResult: getNewestResult,
    assessmentResultPostFn: assessmentResultPostFn
};