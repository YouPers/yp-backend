var calendar = require('../util/calendar'),
    mongoose = require('ypbackendlib').mongoose,
    Event = mongoose.model('Event'),
    Idea = mongoose.model('Idea'),
    Occurence = mongoose.model('Occurence'),
    SocialInteractionModel = mongoose.model('SocialInteraction'),
    SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed'),
    actMgr = require('../core/EventManagement'),
    SocialInteraction = require('../core/SocialInteraction'),
    generic = require('ypbackendlib').handlers,
    error = require('ypbackendlib').error,
    _ = require('lodash'),
    email = require('../util/email'),
    async = require('async'),
    auth = require('ypbackendlib').auth,
    handlerUtils = require('ypbackendlib').handlerUtils;

function getInvitationStatus(req, res, next) {
    SocialInteraction.getInvitationStatus(req.params.id, generic.sendListCb(req, res, next));
}

function getEventLookAheadCounters(req, res, next) {


    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
//
//    if(!req.params.since) {
//        return next(new error.MissingParameterError({ required: 'since' }));
//    }

    var lastAccessSince = req.params.since;
    var locals = {};

    function _newCommentsCount(done) {

        var finder = {
            __t: 'Message',
            targetSpaces: {
                $elemMatch: { targetId: req.params.id }
            }
        };

        if(lastAccessSince) {
            finder.created = {
                $gt: lastAccessSince
            };
        }

        SocialInteractionModel.count(finder).exec(function (err, count) {
            if (err) {
                return done(err);
            }
            locals.comments = count;
            done();
        });
    }

    function _newJoiningUsersCount(done) {
        var finder = {
            __t: 'Invitation',
            event: mongoose.Types.ObjectId(req.params.id)
        };

        // all invitations for this event
        SocialInteractionModel.find(finder).exec(function (err, invitations) {
            if (err) {
                return done(err);
            }

            var finder = {
                socialInteraction: { $in: _.map(invitations, '_id') },
                reason: 'eventJoined'
            };

            if(lastAccessSince) {
                finder.created = {
                    $gt: lastAccessSince
                };
            }

            // all new eventJoined
            SocialInteractionDismissedModel.count(finder).exec(function (err, count) {
                if (err) {
                    return done(err);
                }
                locals.joiningUsers = count;
                done();
            });

        });
    }

    async.parallel([
            _newCommentsCount,
            _newJoiningUsersCount
        ],
        function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            res.send(locals);
            return next();
        });

}

function validateEvent(req, res, next) {
    var sentEvent = req.body;

    // check required Attributes
    if (!sentEvent.start) {
        return next(new error.MissingParameterError({ required: 'start' }));
    }
    if (!sentEvent.end) {
        return next(new error.MissingParameterError({ required: 'end' }));
    }

    if (!sentEvent.recurrence.byday) {
        sentEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    // generate all occurences from the sentEvent to validate -> sentEvents
    var newEvents = actMgr.getOccurences(sentEvent, req.user.id);

    // load all planned occurences of this user that:
    //     plannedEvent.start before the end of the last sentEvent.end
    // AND
    //     .plannedEventend after the begin of the first sentEvent.start
    // only these occurences can have conflicts

    // TODO: improve performance by only loading plans that possibly conflict. This query here uses the status flag which is good enough to filter all old occurences.
    // var beginOfFirstNewEvent = newEvents[0].start;
    // var endOfLastNewEvent = newEvents[newEvents.length-1].end;


    // if the sentEvent has an id, we want to exclude it from the conflicts-search, because this is an editing of a event
    // and conflicts with itself should not be returned.
    var q = Occurence
        .find({owner: req.user._id, status: 'open'});

    if (sentEvent.id) {
        q.where({event: {$ne: mongoose.Types.ObjectId(sentEvent.id)}});
    }
    q.exec(function (err, oldEvents) {
        if (err) {
            return error.handleError(err, next);
        }
        var validationResult = [];

        // put the occurences of the loaded plans in an ordered list by beginDate
        var plannedEvents = [];

        _.forEach(oldEvents, function (occurence) {
            // use plain "non-mongoose" object to prevent troubles with serializing the "pseudo attribute" title
            var plainEventObj = occurence.toObject();
            // plainEventObj.title = event.title;
            delete plainEventObj._id;
            plannedEvents.push(plainEventObj);
        });

        // go over all newEvents:
        //     forEach newEvent:
        //        find all plannedEvents, that have:
        //                     plannedEvent.start < newEvent.end
        //                     AND
        //                     plannedEvent.end > sentEvent.start:
        //                      WE FOUND A CONFLICT

        _.forEach(newEvents, function (newEvent) {
            var conflictingEvent = _.find(plannedEvents, function (plannedEvent) {
                return ((plannedEvent.start < newEvent.end) && (plannedEvent.end > newEvent.start));
            });

            validationResult.push({occurence: newEvent, conflictingEvent: conflictingEvent});
        });


        // load all activities for the conflicting occurences to populate them
        var conflictingEvents = _.compact(_.map(validationResult, 'conflictingEvent'));
        var conflictingOccurences = _.map(conflictingEvents, 'event');
        Event.find({ _id: { $in: conflictingOccurences }}, function (err, events) {
            if(err) {
                return error.handleError(err, next);
            }
            var eventsById = _.indexBy(events, function(event) {
                return event._id.toString();
            });

            _.each(validationResult, function(result) {
                if(result.conflictingEvent) {
                    var conflictingEventResult = eventsById[result.conflictingEvent.event.toString()];
                    result.conflictingEvent.event = conflictingEventResult;
                }
            });

            res.send(validationResult);
            return next();

        });

    });
}


/**
 * handles a POST request to /Event
 * generates all the Occurences according to the planning options in the event.
 *
 * @param req
 * @param res
 * @param next
 */
function postNewEvent(req, res, next) {
    var sentEvent = req.body;

    // check wether there are direct invitations to create, parse and keep them
    var usersToInvite = req.params.invite;

    if (_.isString(usersToInvite)) {
        usersToInvite = usersToInvite.split(',');
    }

    if (usersToInvite && !_.isArray(usersToInvite)) {
        usersToInvite = [usersToInvite];
    }

    // check whether the flag "inviteOthers has been set
    var inviteOthers = sentEvent.inviteOthers;

    var err = handlerUtils.checkWritingPreCond(sentEvent, req.user, Event);
    if (err) {
        return error.handleError(err, next);
    }

    // check required Attributes

    if (!sentEvent.start) {
        return next(new error.MissingParameterError({ required: 'start' }));
    }
    if (!sentEvent.end) {
        return next(new error.MissingParameterError({ required: 'end' }));
    }

    if (!sentEvent.idea) {
        return next(new error.MissingParameterError('"idea" is a required attribute', { required: 'idea' }));
    }

    if (sentEvent.joiningUsers && sentEvent.joiningUsers.length > 0) {
        return next(new error.InvalidArgumentError('"joiningUsers" has to be emtpy for new event, use JOIN Api to join an existing event'));
    }

    // set defaults
    if (!sentEvent.frequency) {
        sentEvent.frequency = 'once';
    }

    if (!sentEvent.recurrence) {
        sentEvent.recurrence = {};
    }
    // check whether delivered owner is the authenticated user
    if (sentEvent.owner && (req.user.id !== sentEvent.owner)) {
        return next(new error.NotAuthorizedError({
            userId: req.user.id,
            owner: sentEvent.owner
        }));
    }

    // if no owner delivered set to authenticated user
    if (!sentEvent.owner) {
        sentEvent.owner = req.user.id;
    }

    // set the campaign that this event is part of if it has not been set by the client
    if (!sentEvent.campaign && req.user.campaign) {
        sentEvent.campaign = req.user.campaign.id || req.user.campaign; // allow populated and unpopulated campaign
    }

    // set the byday to the user's default if the client did not do it, only for daily activities
    if (sentEvent.frequency === 'day' && !sentEvent.recurrence.byday) {
        sentEvent.recurrence.byday = req.user.profile.prefs.defaultWorkWeek;
    }

    var newEvent = new Event(sentEvent);

    _saveNewEvent(newEvent, req, function (err, savedEvent) {
        if (err) {
            return error.handleError(err, next);
        }

        var occurences = actMgr.getOccurences(savedEvent, req.user.id);

        Occurence.create(occurences, function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            actMgr.emit('event:eventCreated', savedEvent, req.user);

            // if needed we generate the personal invitations
            if (usersToInvite && usersToInvite.length >0) {
                SocialInteraction.createNewPersonalInvitation(req.user, savedEvent, usersToInvite, function (err, savedInv) {
                    if (err) {
                        req.log.error({err: err, inv: savedInv.toObject()}, "Error in async task, event_handlers.js:307");
                    }
                });
            }

            // if needed we generate the public invitation
            if (inviteOthers) {
                SocialInteraction.createNewPublicInvitation(req.user, savedEvent, function (err, savedInv) {
                    if (err) {
                        req.log.error({err: err, inv: savedInv.toObject()}, "Error in async task, event_handlers.js:316");
                    }
                });
                // set the inviteOthers Flag manually again: because we wrote the public invitation async it was not in the DB
                // while the event was saved and reloaded.
                savedEvent.inviteOthers = inviteOthers;
            }

            return generic.writeObjCb(req, res, next)(null, savedEvent);
        });
    });
}


/**
 * save new event with a mongoose obj that already has been validated
 *
 * @param req - the request
 * @param cb - callback(err, savedPlan)
 * @param event
 */
function _saveNewEvent(event, req, cb) {
    var user = req.user;
    var i18n = req.i18n;

    // add fields of idea to the event
    Idea.findById(event.idea).exec(function (err, foundIdea) {
        if (err) {
            return cb(err);
        }

        if (!foundIdea) {
            return cb(new error.InvalidArgumentError('referenced idea not found', { required: 'idea', idea: event.idea }));
        }

        if (!event.title) {
            event.title = foundIdea.title;
        }

        event.save(function (err, savedEvent) {
            if (err) {
                return cb(err);
            }

            // we reload Event for two reasons:
            // - populate 'idea' so we can get create a nice calendar entry
            // - we need to reload so we get the changes that have been done pre('save') and pre('init')
            //   like updating the joiningUsers Collection
            Event.findById(savedEvent._id).populate('owner', '+email').populate('idea', mongoose.model('Idea').getI18nPropertySelector(req.locale)).exec(function (err, reloadedEvent) {
                if (err) {
                    return cb(err);
                }

                if (user && user.email && user.profile.prefs.email.iCalInvites) {
                    req.log.debug({start: reloadedEvent.start, end: reloadedEvent.end}, 'Saved New event');
                    var myIcalString = calendar.getIcalObject(reloadedEvent, user, 'new', i18n).toString();
                    email.sendCalInvite(user, 'new', myIcalString, reloadedEvent, i18n);
                }

                actMgr.emit('event:eventSaved', reloadedEvent);

                // remove the populated idea because the client is not gonna expect it to be populated.
                reloadedEvent.idea = reloadedEvent.idea._id;

                return cb(null, reloadedEvent);

            });

        });
    });
}


function postJoinEventFn(req, res, next) {

    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }

    Event.findById(req.params.id).populate({path: 'owner', select: '+email'}).exec(function (err, masterEvent) {
        if (err) {
            return error.handleError(err, next);
        }

        if (_.any(masterEvent.joiningUsers, function(joinerObjId) {
            return joinerObjId.equals(req.user._id);
        })) {
            return next(new error.InvalidArgumentError('this user has already joined this event', {user: req.user, event: masterEvent}));
        }

        masterEvent.joiningUsers.push(req.user.id);
        var occurences = actMgr.getOccurences(masterEvent, req.user.id);

        Occurence.create(occurences, function (err, occurences) {
            if (err) {
                return error.handleError(err, next);
            }
            if (req.user && req.user.email && req.user.profile.prefs.email.iCalInvites) {
                var myIcalString = calendar.getIcalObject(masterEvent, req.user, 'new', req.i18n).toString();
                email.sendCalInvite(req.user, 'new', myIcalString, masterEvent, req.i18n);
            }
            masterEvent.save(generic.writeObjCb(req, res, next));
            actMgr.emit('event:eventJoined', masterEvent, req.user);
        });
    });

}


function postEventInvite(req, res, next) {
    if (!req.params || !req.params.id || req.params.id === 'undefined') {
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
        // first load Event
        function (done) {
            Event.findById(req.params.id)
                .populate('idea')
                .populate('owner')
                .exec(function (err, event) {
                    if (err) {
                        return done(err);
                    }
                    if (!event) {
                        return done(new error.ResourceNotFoundError('Event not found.', {
                            id: req.params.id
                        }));
                    }
                    locals.event = event;
                    return done();
                });
        },
        // for each email try whether we have a user in the Db with this email address and, if yes, load the user
        // to personalize the email
        // then send the invitation mails
        function (done) {

            // collect known users for storing invitations
            var recipients = [];

            async.forEach(emails,
                function (emailaddress, done) {
                    mongoose.model('User')
                        .find({email: emailaddress})
                        .exec(function (err, invitedUsers) {
                            if (err) {
                                return done(err);
                            }

                            if (invitedUsers && invitedUsers.length === 1) {
                                recipients.push(invitedUsers[0]);
                            } else {
                                recipients.push(emailaddress);
                            }

                            // send email moved to SI event consumer
                            return done();
                        });
                },
                function (err) {
                    if (err) {
                        return error.handleError(err, done);
                    }
                    SocialInteraction.emit('invitation:event', req.user, recipients, locals.event);
                    done();
                });
        }
    ], function (err) {
        if (err) {
            return error.handleError(err, next);
        }
        res.send(200);
        return next();
    });
}


function _sendIcalMessages(event, joiner, req, reason, type, done) {
    var users;
    if (joiner) {
        users = [joiner];
    } else {
        users = [event.owner].concat(event.joiningUsers);
    }

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, populatedUsers) {
        async.forEach(populatedUsers, function (user, next) {
                if (user.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(event, user, type, req.i18n, reason).toString();
                    email.sendCalInvite(user, type, myIcalString, event, req.i18n, reason);
                }
                return next();
            },
            done);
    });
}
function _deleteOccurences(event, joiner, fromDate, done) {

    var q = Occurence
        .remove({event: event._id});

    if (fromDate) {
        q.where({end: {$gte: fromDate}});
    }

    if (joiner) {
        q.where({owner: joiner._id});
    }

    q.exec(function (err, count) {
        if (err) {
            return done(err);
        }
        return done(null);
    });
}

function deleteEvent(req, res, next) {
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    var reason = req.params.reason || 'The organizer Deleted this event';

    Event
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, event) {

            if (err) {
                return error.handleError(err, next);
            }
            if (!event) {
                return next(new error.ResourceNotFoundError('Event not found.', {
                    id: req.params.id
                }));
            }
            var joiner = _.find(event.joiningUsers, function (user) {
                return user.equals(req.user);
            });

            var sysadmin = auth.checkAccess(req.user, auth.accessLevels.al_systemadmin);

            var owner = event.owner._id.equals(req.user._id);

            // event can be deleted if user is systemadmin or if it is his own event or if the user is a joiner
            if (!(sysadmin || owner || joiner)) {
                return next(new error.NotAuthorizedError());
            }

            if (event.deleteStatus === Event.notDeletableNoFutureEvents && !sysadmin) {
                // if this is not deletable because of no future occurences we have in fact
                // nothing to do, we just pretend that we deleted all future occurences, by doing nothing
                // and signalling success
                actMgr.emit('event:eventDeleted', event);
                res.send(200);
                return next();
            }

            function _deleteEvents(done) {
                if (sysadmin) {
                    _deleteOccurences(event, joiner, null, done);
                } else {
                    _deleteOccurences(event, joiner, new Date(), done);
                }
            }

            function _sendCalendarCancelMessages(done) {
                _sendIcalMessages(event, joiner, req, reason, 'cancel', done);
            }

            function _deleteEvent(done) {

                if (joiner) {
                    event.joiningUsers.remove(req.user);
                    event.save(done);
                } else {
                    var deleteStatus = event.deleteStatus;
                    if (deleteStatus === 'deletable' || sysadmin) {
                        event.status = 'deleted';
                        return event.save(done);
                    } else if (deleteStatus === 'deletableOnlyFutureEvents') {
                        event.status = 'old';
                        if (event.frequency !== 'once') {
                            event.recurrence.on = new Date();
                            event.recurrence.after = undefined;
                            event.save(done);
                        } else {
                            return done(new Error('should never arrive here, it is not possible to have an "once" event that has ' +
                                'passed and future events at the same time'));
                        }
                    } else {
                        return done(new Error('unknown DeleteStatus: ' + event.deleteStatus));
                    }

                }

            }

            return async.parallel([
                    _sendCalendarCancelMessages,
                    _deleteEvents,
                    _deleteEvent
                ],
                function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    if (joiner) {
                        actMgr.emit('event:participationCancelled', event, req.user);
                    } else {
                        actMgr.emit('event:eventDeleted', event);
                    }
                    res.send(200);
                    return next();
                });
        });
}


function putEvent(req, res, next) {
    var sentEvent = req.body;

    sentEvent.inviteOthers = sentEvent.inviteOthers === 'true' ? true : false;
    var err = handlerUtils.checkWritingPreCond(sentEvent, req.user, Event);
    if (err) {
        return error.handleError(err, next);
    }

    Event
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, loadedEvent) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!loadedEvent) {
                return next(new error.ResourceNotFoundError('Event not found.', { id: sentEvent.id }));
            }

            // check to see if received event is editable
            if (loadedEvent.editStatus !== "editable") {
                return next(new error.ConflictError('Error updating in eventPutFn: Not allowed to edit this event.', {
                    eventId: sentEvent.id,
                    editStatus: loadedEvent.editStatus
                }));
            }

            // we do not allow to update the owner of and the joiningUsers array directly with a put.
            delete sentEvent.owner;
            delete sentEvent.joiningUsers;

            _.extend(loadedEvent, sentEvent);


            function _saveEvent(done) {
                loadedEvent.save(done);
            }

            function _eventsNeedUpdate (loadedAct, sentAct) {
                if (!sentAct.start && !sentAct.end && !sentAct.frequency && !sentAct.recurrence) {
                    // nothing relevant for the events sent, so return false;
                    return false;
                }
                // otherwise compare the relevant fields
                return ((sentAct.start !== loadedAct.start) ||
                    (sentAct.end !== loadedAct.end) ||
                    (sentAct.frequency !== loadedAct.frequency) ||
                    !_.isEqual(sentAct.recurrence, loadedAct.recurrence));
            }

            function _deleteEventsInFuture(done) {
                if (_eventsNeedUpdate(sentEvent, loadedEvent)) {
                    return _deleteOccurences(loadedEvent, null, new Date(), done);
                } else {
                    return done();
                }
            }

            function _sendCalendarUpdates(done) {
                _sendIcalMessages(loadedEvent, null, req, null, 'update', done);
            }


            function finalCb(err) {
                if (err) {
                    return error.handleError(err, next);
                }

                loadedEvent.idea = loadedEvent.idea._id;

                // set the inviteOthers Flag manually again: because we wrote the public invitation async it was not in the DB
                // while the event was saved and reloaded.
                loadedEvent.inviteOthers = sentEvent.inviteOthers;

                actMgr.emit('event:eventUpdated', loadedEvent);

                res.send(200, loadedEvent);
                return next();
            }


            function _updateEventsForAllUsers(done) {
                if (_eventsNeedUpdate(sentEvent, loadedEvent)) {
                    var users = [loadedEvent.owner].concat(loadedEvent.joiningUsers);

                    return async.forEach(users, function (user, cb) {
                        var occurences = actMgr.getOccurences(loadedEvent, user._id, new Date());
                        Occurence.create(occurences, cb);
                    }, done);
                } else {
                    return done();
                }

            }

            return async.parallel([
                    _saveEvent,
                    _sendCalendarUpdates,
                    function (done) {
                        async.series([
                            _deleteEventsInFuture,
                            _updateEventsForAllUsers
                        ], done);
                    }
                ],
                finalCb);
        });
}

function getAll(req, res, next) {

    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    }
    var finder = { $or: [
        { owner: req.user.id },
        { joiningUsers: req.user.id }
    ]};

    var dbQuery = Event.find(finder);

    dbQuery.where({status: {$ne: 'deleted'}});

    var op = generic.addStandardQueryOptions(req, dbQuery, Event);
    op.exec(generic.sendListCb(req, res, next));

}

function getIcal(req, res, next) {
    if (!req.params.id) {
        return next(new error.MissingParameterError({ required: 'id' }));
    }
    if (!req.params.user) {
        return next(new error.MissingParameterError({ required: 'user' }));
    }
    if (!req.params.type) {
        return next(new error.MissingParameterError({ required: 'type' }));
    }
    Event
        .findById(req.params.id)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, loadedEvent) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!loadedEvent) {
                return next(new error.ResourceNotFoundError({event: req.params.id}));
            }
            mongoose.model('User').findById(req.params.user).select('+email +profile').populate('profile').exec(function (err, user) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (!user) {
                    return next(new error.ResourceNotFoundError({user: req.params.user}));
                }
                var ical = calendar.getIcalObject(loadedEvent, user, req.params.type || 'new', req.i18n).toString();
                res.contentType = 'text/calendar';
                res.send(ical);
                return next();

            });
        });
}


module.exports = {
    postNewEvent: postNewEvent,
    postJoinEventFn: postJoinEventFn,
    postEventInvite: postEventInvite,
    deleteEvent: deleteEvent,
    putEvent: putEvent,
    getInvitationStatus: getInvitationStatus,
    validateEvent: validateEvent,
    getEventLookAheadCounters: getEventLookAheadCounters,
    getIcal: getIcal,
    getAll: getAll
};