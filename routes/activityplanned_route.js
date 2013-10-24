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
    _ = require('lodash'),
    caltools = require('calendar-tools');


function generateEventsForPlan(plan, log) {
    var seed = caltools.seed(plan.mainEvent, {addNoRec: true});
    log.trace({seed: seed}, 'generated seed');
    var instances = seed.getInstances(new Date(), new Date(2015, 1, 1));
    plan.events = [];
    _.forEach(instances, function (instance) {
        plan.events.push({
            status: 'open',
            begin: instance.start,
            end: instance.end
        });
    });
    return plan;
}

/**
 * handles a PUT request to /activityPlanned/:planId/event/:eventId.
 * Expects that the ActivityPlan and the event with the corresponding Id exisits. Only allows the owning user
 * of the ActivityPlan to update the ActivityEvent.
 * Handles one or more new comments in the ActivityEvent. A comment is considered "new" when there is no id.
 * Comment.author is overwritten by the currently logged in user.
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function putActivityEvent(req, res, next) {

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

        // TODO: (rblu) check whether new owner is same als old owner???
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
                comment.refDoc = req.params.planId;
                comment.refDocModel = 'ActivityPlanned';
                comment.refDocPath = 'events.' + req.params.eventId;
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
                for (var i = 1; i < arguments.length; i++) {
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

/**
 * handles a POST request to /activityPlanned
 * generates all the ActivityEvents according to the planning options in the plan.
 *
 * @param req
 * @param res
 * @param next
 */
function postNewActivityPlan(req, res, next) {
    req.log.trace({parsedReq: req}, 'Post new ActivityPlan');
    if (!req.body) {
        return next(new restify.InvalidContentError('exptected JSON body in POST'));
    }
    var sentPlan = req.body;
    req.log.trace({body: sentPlan}, 'parsed req body');
    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference only
    // do this check only for properties of type ObjectID
    var schema = Model.schema;
    _.filter(schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in req.body) && (!(typeof req.body[myPath.path] === 'string' || req.body[myPath.path] instanceof String))) {
                req.body[myPath.path] = req.body[myPath.path].id;
            }
        });


    // check whether delivered owner is the authenticated user
    if (req.body.owner && (req.user.id !== req.body.owner)) {
        return next(new restify.NotAuthorizedError('POST of object only allowed if owner == authenticated user'));
    }

    // if no owner delivered set to authenticated user
    if (!req.body.owner) {
        req.body.owner = req.user.id;
    }

    req.log.trace({MainEvent: sentPlan.mainEvent}, 'before generating events');
    generateEventsForPlan(sentPlan, req.log);
    req.log.trace({eventsAfter: sentPlan.events}, 'after generating events');

    var newActPlan = new Model(req.body);


    req.log.trace(newActPlan, 'PostFn: Saving new Object');
    // try to save the new object
    newActPlan.save(function (err) {
        if (err) {
            req.log.info({Error: err}, 'Error Saving in PostFn');
            err.statusCode = 409;
            return next(err);
        }
        res.header('location', '/api/v1/activitiesPlanned' + '/' + newActPlan._id);
        res.send(201, newActPlan);
        return next();
    });
}

module.exports = function (app, config) {

    var baseUrl = '/api/v1/activitiesPlanned';

    app.get(baseUrl, passport.authenticate('basic', { session: false }), genericRoutes.getAllFn(baseUrl, Model));
    app.get(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.getByIdFn(baseUrl, Model));
    app.put(baseUrl + '/:id', passport.authenticate('basic', { session: false }), genericRoutes.putFn(baseUrl, Model));
    app.del(baseUrl + '/:id', genericRoutes.deleteByIdFn(baseUrl, Model));
    app.del(baseUrl, genericRoutes.deleteAllFn(baseUrl, Model));

    app.post(baseUrl, passport.authenticate('basic', { session: false }), postNewActivityPlan);
    app.put(baseUrl + '/:planId/events/:eventId', passport.authenticate('basic', { session: false }), putActivityEvent);
};
