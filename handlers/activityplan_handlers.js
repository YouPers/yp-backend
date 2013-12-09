var mongoose = require('mongoose'),
    Model = mongoose.model('ActivityPlan'),
    CommentModel = mongoose.model('Comment'),
    genericHandlers = require('./generic'),
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
 * handles a PUT request to /ActivityPlan/:planId/event/:eventId.
 * Expects that the ActivityPlan and the event with the corresponding Id exists. Only allows the owning user
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


    var find = Model.findById(req.params.planId).populate('activity');

    find.exec(function (err, planFromDb) {
        if (err) {
            return next(err);
        }

        if (!planFromDb) {
            return next(new restify.ResourceNotFoundError('no activityPlan found with Id: ' + req.params.planId));
        }

        // TODO: (rblu) check whether new owner is same als old owner???
        if (!planFromDb.owner || !planFromDb.owner.equals(req.user.id)) {
            return next(new restify.NotAuthorizedError('authenticated user is not authorized to update this plan: ' + planFromDb));
        }

        var eventFromDb = _.find(planFromDb.events, {'id': req.params.eventId});
        if (!eventFromDb) {
            return next(new restify.ResourceNotFoundError('no event found with Id: ' + req.params.eventId + ' in plan: ' + req.params.planId));
        }

        var eventToPut = genericHandlers.clean(req.body);

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

        var saveCallback = function (err, savedActivityPlan) {
            if (err) {
                req.log.error({error: err, stack: err.stack}, "error saving ");
                return next(err);
            }

            Model.findById(savedActivityPlan._id, function (err, reloadedPlan) {
                if (err) {
                    return next(err);
                }
                var savedEvent = _.find(reloadedPlan.events, {'id': req.params.eventId});
                res.send(200, savedEvent);
                return next();
            });
        };


        if (newComments && newComments.length > 0) {
            newComments.forEach(function (comment) {
                comment.refDoc = planFromDb.masterPlan || req.params.planId;
                comment.refDocModel = 'ActivityPlan';
                // TODO: (RBLU) in case of slave documents, this might not be the correct path. Need to think about where the comment really belongs...,
                // might have to point to the corresponding master event id
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
                // the callbackFn is called with an optional argument for each created comment
                // we use this to set the ids of the created comments to the updated event
                req.log.trace({arguments: arguments}, "Arguments of comments creation");
                for (var i = 1; i < arguments.length; i++) {
                    eventFromDb.comments.push(arguments[i].id);
                }
                planFromDb.save(saveCallback);
            });
        } else {
            planFromDb.save(saveCallback);
        }
    });
}

/**
 * handles a POST request to /ActivityPlan
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
    _.filter(Model.schema.paths, function (path) {
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
    if (!sentPlan.mainEvent) {
        return next(new restify.InvalidArgumentError('Need MainEvent in submitted ActivityPlan'));
    }
    generateEventsForPlan(sentPlan, req.log);
    req.log.trace({eventsAfter: sentPlan.events}, 'after generating events');

    var newActPlan = new Model(req.body);


    req.log.trace(newActPlan, 'PostFn: Saving new Object');
    // try to save the new object
    newActPlan.save(function (err) {
        if (err) {
            req.log.error({Error: err}, 'Error Saving in PostFn');
            err.statusCode = 409;
            return next(err);
        }
        Model.findById(newActPlan._id, function (err, reloadedActPlan) {
            if (err) {
                return next(err);
            }
            res.header('location', '/api/v1/activitiesPlanned' + '/' + reloadedActPlan._id);
            res.send(201, reloadedActPlan);
            return next();
        });
    });
}


function getIcalStringForPlan(req, res, next) {
    Model.findById(req.params.id, {populate: 'activity'}).exec(function (err, plan) {
        if (err) {
            return next(err);
        }
        if (!plan) {
            res.send(204, []);
            return next();
        }
        var icalRecString = caltools.rfc2445.genRecurrenceString(plan.mainEvent);
        res.contentType = "text/calendar";
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'inline; filename=ical.ics');
        res.send(icalRecString);
        return next();
    });
}

module.exports = {
    postNewActivityPlan: postNewActivityPlan,
    getIcalStringForPlan: getIcalStringForPlan,
    putActivityEvent: putActivityEvent
};