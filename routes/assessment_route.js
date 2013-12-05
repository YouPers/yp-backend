/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Assessment = mongoose.model('Assessment'),
    AssessmentResult = mongoose.model('AssessmentResult'),
    genericRoutes = require('./generic'),
    passport = require('passport');


module.exports = function (app, config) {

    var baseUrl = '/assessments';

    var getNewestResult = function (baseUrl, Model) {
        return function (req, res, next) {
            Model.find({assessment: req.params.assId, owner: req.user.id})
                .sort({timestamp: -1})
                .limit(1)
                .exec(function (err, result) {
                    if (err) {
                        return next(err);
                    }
                    req.log.trace({foundAssResults: result}, 'GET Newest Ass Results');
                    if (!result || result.length === 0){
                        res.send(204, []);
                        return next();
                    }
                    res.send(result[0]);
                    return next();
                });
        };
    };

    var resultsUrl = baseUrl + '/:assId/results';

    app.post({path: resultsUrl, name: 'post-assessmentResults'}, passport.authenticate('basic', { session: false }), genericRoutes.postFn(resultsUrl, AssessmentResult));
    app.get({path: resultsUrl+ '/newest', name: 'get-assessmentResults-newest'}, passport.authenticate('basic', { session: false }), getNewestResult(resultsUrl, AssessmentResult));
    app.get(resultsUrl, passport.authenticate('basic', { session: false }), genericRoutes.getAllFn(resultsUrl, AssessmentResult));
    app.del(resultsUrl, passport.authenticate('basic', { session: false }), genericRoutes.deleteAllFn(resultsUrl, AssessmentResult));


    app.get(baseUrl, genericRoutes.getAllFn(baseUrl, Assessment));
    app.get(baseUrl + '/:id', genericRoutes.getByIdFn(baseUrl, Assessment));
    app.post(baseUrl, genericRoutes.postFn(baseUrl, Assessment));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Assessment));

};