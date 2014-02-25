var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    mongoose = require('mongoose'),
    ActivityPlanModel = mongoose.model('ActivityPlan'),
    ActivityModel = mongoose.model('Activity'),
    CommentModel = mongoose.model('Comment'),
    generic = require('./generic'),
    error = require('../util/error'),
    _ = require('lodash'),
    ical = require('icalendar'),
    email = require('../util/email'),
    moment = require('moment'),
    async = require('async'),
    auth = require('../util/auth');

var getIcalObject = function (plan, recipientUser, iCalType, i18n) {

    // fix for non existing plan.text
    if (_.isUndefined(plan.text)) {
        plan.text = "";
    }

    var myCal = new ical.iCalendar();
    var event = new ical.VEvent(plan._id);
    event.addProperty("ORGANIZER", "MAILTO:dontreply@youpers.com", {CN: "YouPers Digital Health"});
    myCal.addProperty("CALSCALE", "GREGORIAN");
    event.addProperty("ATTENDEE",
        "MAILTO:" + recipientUser.email,
        {CUTYPE: "INDIVIDUAL", ROLE: "REQ-PARTICIPANT", PARTSTAT: "NEEDS-ACTION", CN: recipientUser.fullname, "X-NUM-GUESTS": 0 });

    if (iCalType === 'new' || iCalType === 'update') {
        myCal.addProperty("METHOD", "REQUEST");
        event.addProperty("STATUS", "CONFIRMED");
        event.addProperty("SEQUENCE", 0);
    } else if (iCalType === 'cancel') {
        myCal.addProperty("METHOD", "CANCEL");
        event.addProperty("STATUS", "CANCELLED");
        event.addProperty("SEQUENCE", 1);
    } else if (iCalType === 'eventsGenerationOnly') {
        // do nothing here, we do not these properties if we only need the object for eventsGeneration
    }
    else {
        throw new Error('unknown iCal ObjectType: ' + iCalType);
    }

    if (iCalType !== 'eventsGenerationOnly') {
        // these properties are not needed for events-generation, so we don't set them
        var link = config.webclientUrl + "/#/activities/" + plan.activity._id;

        event.setSummary(i18n.t('ical:' + iCalType + ".summary", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON()}));
        event.setDescription(i18n.t('ical:' + iCalType + ".description", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON(), link: link}));
        // HTML in description: see here: http://www.limilabs.com/blog/html-formatted-content-in-the-description-field-of-an-icalendar
        event.addProperty("X-ALT-DESC",
            i18n.t('ical:' + iCalType + ".htmlDescription",
                {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON(), link: link}),
            {'FMTTYPE': 'text/html'});
        event.addProperty("LOCATION", plan.location);
        var notifPref = recipientUser.profile.userPreferences.calendarNotification || "900";
        if (notifPref !== 'none') {
            var alarm = event.addComponent('VALARM');
            alarm.addProperty("ACTION", "DISPLAY");
            alarm.addProperty("TRIGGER", -1 * notifPref);
            alarm.addProperty("DESCRIPTION", i18n.t('ical:' + iCalType + ".summary", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON()}));
        }
    }

    event.setDate(moment(plan.mainEvent.start).toDate(), moment(plan.mainEvent.end).toDate());


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
            rruleSpec.BYDAY = recipientUser.preferences && recipientUser.preferences.workingDays && recipientUser.preferences.workingDays.length > 0 ?
                recipientUser.preferences.workingDays.join(',')
                : "MO,TU,WE,TH,FR";
        }


        if (plan.mainEvent.recurrence.endby.type === 'on') {
            rruleSpec.UNTIL = plan.mainEvent.recurrence.endby.on;
        } else if (plan.mainEvent.recurrence.endby.type === 'after') {
            rruleSpec.COUNT = plan.mainEvent.recurrence.endby.after;
        }

        event.addProperty("RRULE", rruleSpec);
    }
    event.addProperty("TRANSP", "OPAQUE");
    myCal.addComponent(event);
    return myCal;
};

function generateEventsForPlan(plan, user, i18n) {

    // ToDo: has to be enhanced with functionality to generate only future events for a puts (additional from date as parameter)

    var myIcalObj = getIcalObject(plan, user, 'eventsGenerationOnly', i18n);

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
        return next(new error.MissingParameterError({ required: 'planId' }));
    }

    var find = ActivityPlanModel.findById(req.params.planId).populate('activity');

    find.exec(function (err, planFromDb) {
        if(err) {
            return error.handleError(err, next);
        }

        if (!planFromDb) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found', { id: req.params.planId }));
        }

        // TODO: (rblu) check whether new owner is same als old owner???
        if (!planFromDb.owner || !planFromDb.owner.equals(req.user.id)) {
            return next(new error.NotAuthorizedError('The user is not authorized to update this plan.', {
                userId: req.user.id,
                activityPlanId: planFromDb.id,
                owner: planFromDb.owner
            }));
        }

        var eventFromDb = _.find(planFromDb.events, {'id': req.params.eventId});
        if (!eventFromDb) {
            return next(new error.ResourceNotFoundError('Event not found in ActivityPlan', {
                eventId: req.params.eventId,
                activityPlanId: req.params.planId
            }));
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
            if(err) {
                return error.handleError(err, next);
            }

            ActivityPlanModel.findById(savedActivityPlan._id, function (err, reloadedPlan) {
                if(err) {
                    return error.handleError(err, next);
                }
                var savedEvent = _.find(reloadedPlan.events, {'id': req.params.eventId});
                res.send(200, savedEvent);
                return next();
            });
        };

        // set plan status to 'old' if no more events are 'open'
        if (planFromDb.status === 'active' && !_.any(planFromDb.events, {status: 'open'})) {
            planFromDb.status = 'old';
        }

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
                if(err) {
                    return error.handleError(err, next);
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
        return next(new error.MissingParameterError('activityPlan object'));
    }
    var sentPlan = req.body;
    req.log.trace({body: sentPlan}, 'parsed req body');
    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference only
    // do this check only for properties of type ObjectID
    _.filter(ActivityPlanModel.schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in sentPlan) && (!(typeof sentPlan[myPath.path] === 'string' || sentPlan[myPath.path] instanceof String))) {
                sentPlan[myPath.path] = sentPlan[myPath.path].id;
            }
        });


    // check whether delivered owner is the authenticated user
    if (sentPlan.owner && (req.user.id !== sentPlan.owner)) {
        return next(new error.NotAuthorizedError({
            userId: req.user.id,
            owner: sentPlan.owner
        }));
    }

    // if no owner delivered set to authenticated user
    if (!sentPlan.owner) {
        sentPlan.owner = req.user.id;
    }

    // set the campaign that this Plan is part of
    if (req.user.campaign) {
        sentPlan.campaign = req.user.campaign.id || req.user.campaign; // allow populated and unpopulated campaign
    }

    req.log.trace({MainEvent: sentPlan.mainEvent}, 'before generating events');
    if (!sentPlan.mainEvent) {
        return next(new error.MissingParameterError({ required: 'mainEvent' }));
    }
    generateEventsForPlan(sentPlan, req.user, req.i18n);
    req.log.trace({eventsAfter: sentPlan.events}, 'after generating events');

    var newActPlan = new ActivityPlanModel(sentPlan);

    // add fields of activity to the activity plan
    ActivityModel.findById(newActPlan.activity).exec(function (err, foundActivity) {
        if(err) {
            return error.handleError(err, next);
        }
        newActPlan.fields = foundActivity.fields;

        req.log.trace(newActPlan, 'PostFn: Saving new Object');
        // try to save the new object
        newActPlan.save(function (err) {
            if(err) {
                return error.handleError(err, next);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlanModel.findById(newActPlan._id).populate('activity').exec(function (err, reloadedActPlan) {
                if(err) {
                    return error.handleError(err, next);
                }

                if (req.user && req.user.email && req.user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = getIcalObject(reloadedActPlan, req.user, 'new', req.i18n).toString();
                    email.sendCalInvite(req.user.email, 'new', myIcalString, req.i18n);
                }

                // remove the populated activity because the client is not gonna expect it to be populated.
                reloadedActPlan.activity = reloadedActPlan.activity._id;
                res.header('location', '/api/v1/activitiesPlanned' + '/' + reloadedActPlan._id);
                res.send(201, reloadedActPlan);
                return next();
            });

        });
    });
}

function getJoinOffers(req, res, next) {

    // check whether the required param 'activity' is here and add it to the dbquery
    if (!req.params.activity) {
        return next(new error.MissingParameterError({ required: 'activity' }));
    }

    var dbquery = ActivityPlanModel.find(
        {activity: req.params.activity,
            executionType: 'group',
            masterPlan: null
        });

    dbquery.where('visibility').ne('private');

    if (req.user.campaign) {
        dbquery.or([
            {campaign: req.user.campaign.id || req.user.campaign},
            {campaign: null, visibility: 'public'}
        ]);
    } else {
        dbquery.and([
            {'campaign': null},
            {'visibility': 'public'}
        ]);
    }

    generic.addStandardQueryOptions(req, dbquery, ActivityPlanModel);
    dbquery.exec(function (err, joinOffers) {
        if(err) {
            return error.handleError(err, next);
        }
        if (!joinOffers || joinOffers.length === 0) {
            res.send(200, []);
            return next();
        }

        res.send(200, joinOffers);
        return next();
    });

}

function postActivityPlanInvite(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.body || !req.body.email) {
        return next(new error.MissingParameterError({ required: 'email' }));
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
                        return done(new error.ResourceNotFoundError('ActivityPlan not found.', {
                            id: req.params.id
                        }));
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
                            email.sendActivityPlanInvite(emailaddress, req.user, locals.plan, invitedUser && invitedUser[0], req.i18n);
                            return done();
                        });
                },
                function (err) {
                    done();
                });
        }
    ], function (err) {
        if(err) {
            return error.handleError(err, next);
        }
        res.send(200);
        return next();
    });
}

function deleteActivityPlan(req, res, next) {

    ActivityPlanModel.findById(req.params.id).populate('activity').exec(function (err, activityPlan) {
        if(err) {
            return error.handleError(err, next);
        }
        if (!activityPlan) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found.', {
                id: req.params.id
            }));
        }


        // we need the owner of the plan to send him a cancellation to his email address
        mongoose.model('User').findById(activityPlan.owner).populate('profile').select('+email +profile').exec(function (err, owner) {
            if(err) {
                return error.handleError(err, next);
            }

            if (!owner) {
                return next(new error.ResourceNotFoundError('ActivityPlan owner not found.', {
                    activityPlanId: activityPlan.id,
                    owner: activityPlan.owner
                }));
            }

            ////////////////////
            // private functions
            var _removeCallback = function (err) {
                if(err) {
                    return error.handleError(err, next);
                }
                if (owner.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = getIcalObject(activityPlan, owner, 'cancel', req.i18n).toString();
                    email.sendCalInvite(owner.email, 'cancel', myIcalString, req.i18n);
                }
                res.send(200);
                return next();
            };
            ///////////////////

            ///////////
            // if this is a slave of a masterPlan we need to remove the owner of the slave plan from the
            // joiningUsers collection of the master
            if (activityPlan.masterPlan) {
                ActivityPlanModel.findById(activityPlan.masterPlan, function(err, masterPlan) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    if (!masterPlan) {
                        return new error.ResourceNotFoundError('MasterPlan not found', {
                            masterPlanId: activityPlan.masterPlan
                        });
                    }
                    _.remove(masterPlan.joiningUsers, function(ju) {
                        return ju.equals(activityPlan.owner);
                    });
                    masterPlan.save(function(err) {
                        if (err) {
                            return error.handleError(err, next);
                        }
                    });
                });
            }


            // plan can be deleted if user is systemadmin or if it is his own plan
            if (auth.checkAccess(req.user, auth.accessLevels.al_systemadmin)) {
                activityPlan.remove(_removeCallback);
            } else if (owner._id.equals(req.user._id)) {

                // check deleteStatus
                if (activityPlan.deleteStatus === ActivityPlanModel.activityPlanCompletelyDeletable) {
                    activityPlan.remove(_removeCallback);
                } else if (activityPlan.deleteStatus === ActivityPlanModel.activityPlanOnlyFutureEventsDeletable) {
                    // delete  all future events, set activityPlan to "Done", send cancellations for deleted events
                    var now = new Date();
                    var tempEvents = activityPlan.events.slice();
                    tempEvents.forEach(function (event) {
                        if (event.begin > now && event.end > now) {
                            // start and end date in the future, so delete event and send cancellation
                            activityPlan.events.id(event.id).remove();
                        }
                    });
                    activityPlan.status = "old";
                    activityPlan.save(_removeCallback);
                } else {
                    return next(new error.BadMethodError('This activityPlan cannot be deleted.', {
                        activityPlanId: activityPlan.id,
                        deleteStatus: activityPlan.deleteStatus
                    }));
                }

            } else {
                return next(new error.NotAuthorizedError('The user is not authorized to delete this plan.'));
            }
        });
    });
}

function putActivityPlan(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated ActivityPlan');

    if (!req.body) {
        return next(new error.ResourceNotFoundError('activityPlan object'));
    }

    var sentPlan = req.body;
    req.log.trace({body: sentPlan}, 'parsed req body');

    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference only
    // do this check only for properties of type ObjectID
    _.filter(ActivityPlanModel.schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in sentPlan) && (!(typeof sentPlan[myPath.path] === 'string' || req.body[myPath.path] instanceof String))) {
                sentPlan[myPath.path] = sentPlan[myPath.path].id;
            }
        });

    ActivityPlanModel.findById(req.params.id).exec(function (err, loadedActPlan) {
        if(err) {
            return error.handleError(err, next);
        }
        if (!loadedActPlan) {
            return next(new error.ResourceNotFoundError('ActivityPlan not found.', { id: sentPlan.id }));
        }

        // check to see if received plan is editable
        if (loadedActPlan.editStatus !== "editable") {
            var notEditableError = new Error('Error updating in Activity Plan PutFn: Not allowed to update this activity plan with id: ' );
            notEditableError.statusCode = 409;
            return next(new error.BadMethodError('This activityPlan cannot be edited.', {
                activityPlanId: sentPlan.id,
                editStatus: loadedActPlan.editStatus
            }));
        }

        if (req.body.mainEvent && !_.isEqual(req.body.mainEvent, loadedActPlan.mainEvent)) {
            generateEventsForPlan(req.body, req.user, req.i18n);
        }

        _.extend(loadedActPlan, req.body);

        req.log.trace(loadedActPlan, 'PutFn: Updating existing Object');

        loadedActPlan.save(function (err) {
            if(err) {
                return error.handleError(err, next);
            }

            // we reload ActivityPlan for two reasons:
            // - populate 'activity' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            ActivityPlanModel.findById(loadedActPlan._id).populate('activity').exec(function (err, reloadedActPlan) {
            // we read 'activity' so we can get create a nice calendar entry using using the activity title
                if(err) {
                    return error.handleError(err, next);
                }
                if (req.user && req.user.email && req.user.profile.userPreferences.email.iCalInvites) {
                    var myIcalString = getIcalObject(reloadedActPlan, req.user, 'update', req.i18n).toString();
                    email.sendCalInvite(req.user.email, 'update', myIcalString, req.i18n);
                }

                // remove the populated activity because the client is not gonna expect it to be populated.
                reloadedActPlan.activity = reloadedActPlan.activity._id;
                res.header('location', '/api/v1/activitiesPlanned' + '/' + reloadedActPlan._id);
                res.send(201, reloadedActPlan);
                return next();
            });
        });
    });
}

module.exports = {
    postNewActivityPlan: postNewActivityPlan,
    putActivityEvent: putActivityEvent,
    getJoinOffers: getJoinOffers,
    postActivityPlanInvite: postActivityPlanInvite,
    deleteActivityPlan: deleteActivityPlan,
    putActivityPlan: putActivityPlan
};