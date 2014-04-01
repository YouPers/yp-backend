var HealthCoach = require('../core/HealthCoach'),
    error = require('../util/error');

var hc = new HealthCoach();


var getCoachMessagesFn = function getCoachMessagesFn(req, res, next) {
    if (!req.user) {
        // use default empty user if not logged in
    }

    if (!req.params.uistate) {
        return next(new error.MissingParameterError('uistate is required as a query parameter', { required: 'uistate' }));
    }

    hc.getCurrentMessages(req.user, req.params.uistate, function(err, messageIds, facts) {
        if (err) {
            return error.handleError(err, next);
        }
        res.send(messageIds);
        return next();
    });

};


module.exports = {
    getCoachMessagesFn: getCoachMessagesFn
};