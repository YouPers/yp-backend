var mongoose = require('ypbackendlib').mongoose,
    CoachRecommendation = require('../core/CoachRecommendation'),
    error = require('ypbackendlib').error,
    auth = require('ypbackendlib').auth,
    _ = require('lodash');


var getCoachRecommendationsFn = function getCoachRecommendationsFn(req, res, next) {

    if (!req.user) {
        return next(new error.NotAuthorizedError());
    }

    var admin = auth.isAdminForModel(req.user, mongoose.model('Idea'));
    var topic = (req.params.topic && mongoose.Types.ObjectId(req.params.topic)) ||
        (req.user.campaign && req.user.campaign.topic);

    if (!topic) {
        return next(new error.MissingParameterError('topic must be passed as query param, or the current user must have a campaign set.'));
    }
    var options = {
        topic: topic,
        rejectedIdeas: req.user.profile.prefs.rejectedIdeas,
        focus: req.user.profile.prefs.focus,
        isAdmin: admin
    };
    CoachRecommendation.generateAndStoreRecommendations(req.user._id, options, function (err, recs) {

            if (err) {
                error.handleError(err, next);
            }
            res.send(_.sortBy(recs, function (rec) {
                return -rec.score;
            }) || []);
            return next();
        });
};

module.exports = {
    getCoachRecommendationsFn: getCoachRecommendationsFn
};