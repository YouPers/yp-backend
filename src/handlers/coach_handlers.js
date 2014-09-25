var mongoose = require('ypbackendlib').mongoose,
    HealthCoach = require('../core/HealthCoach'),
    CoachRecommendation = require('../core/CoachRecommendation'),
    error = require('ypbackendlib').error,
    auth = require('ypbackendlib').auth,
    _ = require('lodash');

var hc = new HealthCoach();


var getCoachMessagesFn = function getCoachMessagesFn(req, res, next) {
    if (!req.user) {
        // use default empty user if not logged in
    }

    if (!req.params.uistate) {
        return next(new error.MissingParameterError('uistate is required as a query parameter', { required: 'uistate' }));
    }

    hc.getCurrentMessages(req.user, req.params.uistate, function (err, messageIds, facts) {
        if (err) {
            return error.handleError(err, next);
        }

        var result = messageIds;
        if (req.params.debug) {
            result.push(facts);
        }
        res.send(result);
        return next();
    });

};

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
    getCoachMessagesFn: getCoachMessagesFn,
    getCoachRecommendationsFn: getCoachRecommendationsFn
};