/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlanned'),
    CommentModel = mongoose.model('Comment'),
    genericRoutes = require('./generic'),
    passport = require('passport'),
    restify = require('restify'),
    _ = require('lodash');


function putEvent(req, res, next) {
    req.log.trace({parsedReq: req}, 'put Plan Event');

    if (!req || !req.params || !req.params.planId) {
        return next(new restify.MissingParameterError('no planId found in PUT request'));
    }


    var find = Model.findOne({_id: req.params.planId});
    find.exec(function (err, planFromDb) {
        if (err) {
            return next(err);
        }

        if (!planFromDb) {
            return next(new restify.ResourceNotFoundError('no activityPlan found with Id: ' + req.params.planId));
        }
        if (!planFromDb.owner.equals(req.user.id)) {
            return next(new restify.NotAuthorizedError('authenticated user is not authorized to update this plan'));
        }

        var eventFromDb = _.find(planFromDb.events, {'id': req.params.eventId});
        if (!eventFromDb) {
            return next(new restify.ResourceNotFoundError('no event found with Id: ' + req.params.eventId + ' in plan: ' + req.params.planId));
        }

        var eventToPut = genericRoutes.clean(req.body);

        // checkForNewComments, if there are any comments without id they need to be saved separatly to
        // the comments collection
        var newComments;
        if (eventToPut.comments && Array.isArray(eventToPut.comments) && eventToPut.comments.length > 0) {
            // some comments posted, check if any of them are new (i.e. do not have an id)
            newComments = _.select(eventToPut.comments, function (comment) {
                return !comment.id;
            });
        }

        delete eventToPut.comments;
        _.extend(eventFromDb, eventToPut);

        if (newComments && newComments.length > 0) {
            newComments.forEach(function (comment) {
                comment.refObj = req.params.eventId;
                comment.author = req.user.id;
                if (!comment.created) {
                    comment.created = new Date();
                }
            });
            CommentModel.create(newComments, function (err) {
                if (err) {
                    return next(err);
                }
                req.log.trace({arguments: arguments}, "Arguments of comments creation");
                for (var i = 1; i< arguments.length; i++) {
                    eventFromDb.comments.push(arguments[i].id);
                }
                planFromDb.save(function (err, ret) {
                    if (err) {
                        req.log.error({error: err, stack: err.stack}, "error saving ");
                        return next(err);

                    }
                    var event = _.find(ret.events, {'id': req.params.eventId});
                    res.send(200, event);
                });
            });
        } else {
            planFromDb.save(function (err, ret) {
                if (err) {
                    req.log.error({error: err, stack: err.stack}, "error saving ");
                    return next(err);

                }
                var event = _.find(ret.events, {'id': req.params.eventId});
                res.send(200, event);
            });
        }
    });
}

module.exports = function (app, config) {

    var baseUrl = '/api/v1/activitiesPlanned';

    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.getAllFn(baseUrl, Model));
    app.get(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.getByIdFn(baseUrl, Model));
    app.post(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.postFn(baseUrl, Model));
    app.put(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.putFn(baseUrl, Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));

    app.put(baseUrl + '/:planId/events/:eventId', passport.authenticate('basic', { session: false }), putEvent);
};
