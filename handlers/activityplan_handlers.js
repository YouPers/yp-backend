var mongoose = require('mongoose'),
    ActivityPlanModel = mongoose.model('ActivityPlan'),
    CommentModel = mongoose.model('Comment'),
    generic = require('./generic'),
    restify = require('restify'),
    _ = require('lodash'),
    ical = require('icalendar'),
    email = require('../util/email'),
    moment = require('moment'),
    async = require('async');


var getIcalObject = function (plan, recipientUser) {
    var myCal = new ical.iCalendar();
    myCal.addProperty("METHOD", "REQUEST");
    var event = new ical.VEvent(plan._id);
    event.addProperty("ORGANIZER", "MAILTO:dontreply@youpers.com", {CN: "YouPers Digital Health"});
    event.addProperty("ATTENDEE",
        "MAILTO:" + recipientUser.email,
        {ROLE: "REQ-PARTICIPANT", PARTSTAT: "NEEDS-ACTION", RSVP: "TRUE", CN: recipientUser.fullName });
    event.setSummary(plan.title || plan.activity && plan.activity.title);
    event.setDate(moment(plan.mainEvent.start).toDate(), moment(plan.mainEvent.end).toDate());
    event.addProperty("STATUS", "CONFIRMED");
    event.addProperty("LOCATION", "just do it anywhere");
    if (plan.mainEvent.recurrence && plan.mainEvent.frequency && plan.mainEvent.frequency !== 'once') {
        var frequencyMap = {
            'day': 'DAILY',
            'week': 'WEEKLY',
            'month': 'MONTHLY'
        };
        if (!frequencyMap[plan.mainEvent.frequency]) {
            throw new Error("unknown recurrence frequency");
        }

        var rruleSpec = { FREQ: frequencyMap[plan.mainEvent.frequency] };
        if (rruleSpec.FREQ === 'DAILY') {
            rruleSpec.BYDAY = recipientUser.preferences && recipientUser.preferences.workingDays && recipientUser.preferences.workingDays.length > 0
                ? recipientUser.preferences.workingDays.join(',')
                : "MO,TU,WE,TH,FR";
        }


        if (plan.mainEvent.recurrence.endby.type === 'on') {
            rruleSpec.UNTIL = plan.mainEvent.recurrence.endby.on;
        } else if (plan.mainEvent.recurrence.endby.type === 'after') {
            rruleSpec.COUNT = plan.mainEvent.recurrence.endby.after;
        }

        event.addProperty("RRULE", rruleSpec);
    }
    myCal.addComponent(event);
    return myCal;
};

function generateEventsForPlan(plan, user) {
    var myIcalObj = getIcalObject(plan, user);

    var duration = moment(plan.mainEvent.end).diff(plan.mainEvent.start);
    var rrule = myIcalObj.events()[0].rrule();

    plan.events = [];
    if (rrule) {
        var occurrances = rrule.nextOccurences(moment(plan.mainEvent.start).subtract('day', 1).toDate(), 100);
        _.forEach(occurrances, function (instance) {
            plan.events.push({
                status: 'open',
                begin: instance,
                end: moment(instance).add('ms', duration)
            });
        });
    } else {
        plan.events.push({
            status: 'open',
            begin: plan.mainEvent.start,
            end: plan.mainEvent.end
        });
    }
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

        var eventToPut = generic.clean(req.body);

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

            ActivityPlanModel.findById(savedActivityPlan._id, function (err, reloadedPlan) {
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
    _.filter(ActivityPlanModel.schema.paths, function (path) {
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
    generateEventsForPlan(sentPlan, req.user);
    req.log.trace({eventsAfter: sentPlan.events}, 'after generating events');

    var newActPlan = new ActivityPlanModel(req.body);


    req.log.trace(newActPlan, 'PostFn: Saving new Object');
    // try to save the new object
    newActPlan.save(function (err) {
        if (err) {
            req.log.error({Error: err}, 'Error Saving in PostFn');
            err.statusCode = 409;
            return next(err);
        }
        // we populate 'activity' so we can get create a nice calendar entry using strings on the
        // activity
        ActivityPlanModel.findById(newActPlan._id).populate('activity').exec(function (err, reloadedActPlan) {
            if (err) {
                return next(err);
            }
            if (req.user && req.user.email) {
                var myIcalString = getIcalObject(reloadedActPlan, req.user).toString();
                email.sendCalInvite(req.user.email, 'Neuer YouPers Kalendar Eintrag', myIcalString);
            }

            // remove the populate activity because the client is not gonna expect it to be populated.
            reloadedActPlan.activity = reloadedActPlan.activity._id;
            res.header('location', '/api/v1/activitiesPlanned' + '/' + reloadedActPlan._id);
            res.send(201, reloadedActPlan);
            return next();
        });
    });
}

function getIcalStringForPlan(req, res, next) {
    if (!req.params || !req.params.id) {
        next(new restify.InvalidArgumentError('id required for this call'));
    }
    ActivityPlanModel.findById(req.params.id).populate('activity').populate('owner').exec(function (err, plan) {
        if (err) {
            return next(err);
        }
        if (!plan) {
            res.send(204, []);
            return next();
        }
        var myIcalString = getIcalObject(plan, plan.owner).toString();
        if (req.params.email && plan.owner && plan.owner.email) {
            email.sendCalInvite(plan.owner.email, 'YouPers Calendar Event', myIcalString);

        }
        res.contentType = "text/calendar";
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'inline; filename=ical.ics');
        res.send(200, myIcalString);
        return next();
    });
}

function getJoinOffers(req, res, next) {

    // check whether the required param 'activity' is here and add it to the dbquery
    if (!req.params.activity) {
        return next(new restify.InvalidArgumentError("missing required queryParam 'activity'"));
    }

    var dbquery = ActivityPlanModel.find(
        {activity: req.params.activity,
            executionType: 'group',
            masterPlan: null
        });

    generic.addStandardQueryOptions(req, dbquery, ActivityPlanModel);
    dbquery.exec(function (err, joinOffers) {
        if (err) {
            return next(err);
        }
        if (!joinOffers || joinOffers.length === 0) {
            res.send(204, []);
            return next();
        }

        res.send(200, joinOffers);
        return next();
    });

}

function postActivityPlanInvite(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new restify.InvalidArgumentError('missing required ActivityId in URL'));
    }
    if (!req.body || !req.body.email) {
        return next(new restify.InvalidArgumentError('missing required email attribute in body'));
    }

    // split up the email field, in case we got more than one mail
    var emails;
    if (_.isArray(req.body.email)) {
        emails = req.body.email;
    } else if (req.body.email.indexOf(' ') !== -1) {
        emails = req.body.email.split(' ');
    } else if (req.body.email.indexOf(';') !== -1) {
        emails = req.body.email.split(';');
    } else if (req.body.email.indexOf(',') !== -1) {
        emails = req.body.email.split(',');
    } else {
        emails = [req.body.email];
    }

    var locals = {
    };
    async.series([
        // first load ActivityPlan
        function (done) {
            ActivityPlanModel.findById(req.params.id)
                .populate('activity')
                .populate('owner')
                .exec(function (err, plan) {
                    if (err) {
                        return done(err);
                    }
                    if (!plan) {
                        return done(new restify.InvalidArgumentError('ActivityPlan: ' + req.params.id + ' not found.'));
                    }
                    locals.plan = plan;
                    return done();
                });
        },
        // for each email try whether we have a user in the Db with this email address and, if yes, load the user
        // to personalize the email
        // then send the invitation mails
        function (done) {
            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUser) {
                            if (err) {
                                return done(err);
                            }
                            email.sendActivityPlanInvite(emailaddress, req.user, locals.plan, invitedUser && invitedUser[0]);
                            return done();
                        });
                },
                function (err) {
                    done();
                });
        }
    ], function (err) {
        if (err) {
            return next(err);
        }
        res.send(200);
        return next();
    });
}

module.exports = {
    postNewActivityPlan: postNewActivityPlan,
    getIcalStringForPlan: getIcalStringForPlan,
    putActivityEvent: putActivityEvent,
    getJoinOffers: getJoinOffers,
    postActivityPlanInvite: postActivityPlanInvite
};