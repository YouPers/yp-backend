var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('ypbackendlib').mongoose;
var _ = require('lodash');
var moment = require('moment');
var calendar = require('../util/calendar');
var Invitation = mongoose.model('Invitation');
var Event = mongoose.model('Event');
var Occurence = mongoose.model('Occurence');
var SocialInteraction = require('../core/SocialInteraction');
var config = require('../config/config');
var log = require('ypbackendlib').log(config);
var error = require('ypbackendlib').error;
var auth = require('ypbackendlib').auth;
var async = require('async');
var email = require('../util/email');


var INSPIRATION_CAMPAIGN_ID = '527916a82079aa8704000006';

function EventManagement() {
    EventEmitter.call(this);
}

util.inherits(EventManagement, EventEmitter);
var actMgr = new EventManagement();

/**
 * on Change of an Occurence Status, check whether this was the last open Occurence
 * for this event. If there are no more open Occurences change the status of the event to 'old'
 */
Occurence.on("change:status", function (occurence) {
    // we can stop looking, if the occurence that was changed is still open, e.g. when it is new.
    if (occurence.status === 'open') {
        return;
    }

    log.debug("checking whether Event needs to be put to status 'old'");
    Occurence.count({_id: {$ne: occurence._id}, status: 'open', event: occurence.event}).exec(function (err, count) {
        if (err) {
            log(err);
            throw err;
        }
        log.debug("found " + count + " occurences that are still active");
        if (count === 0) {
            Event.update({_id: occurence.event}, {status: 'old'}, function (err, numAffected) {
                if (err || numAffected > 1) {
                    log.err(err || "more than one event changed, should never happen");
                }

            });
        }
    });
});


actMgr.getOccurences = function getOccurences(event, ownerId, fromDate) {

    var duration = moment(event.end).diff(event.start);

    var occurrences = calendar.getOccurrences(event, fromDate);

    var occurences = [];

    _.forEach(occurrences, function (instance) {
        occurences.push({
            status: 'open',
            start: moment(instance).toDate(),
            end: moment(instance).add(duration, 'ms').toDate(),
            event: event._id,
            idea: event.idea,
            owner: ownerId,
            campaign: event.campaign
        });
    });

    return occurences;
};

actMgr.defaultEvent = function (idea, user, campaignId) {
    var now = moment();
    var duration = idea.defaultduration ? idea.defaultduration : 60;


    if (!campaignId && user.campaign) {
        campaignId = user.campaign._id || user.campaign;
    }

    var start =  moment(now).add(1, 'd').startOf('hour').toDate();


    var event = {
        owner: user._id || user,
        idea: idea,
        status: 'active',
        executionType: idea.defaultexecutiontype,
        fields: idea.fields,
        topics: idea.topics,
        title: idea.title,
        number: idea.number,
        start: start,
        end: moment(start).add(duration, 'm').toDate(),
        allDay: false,
        frequency: idea.defaultfrequency,
        recurrence: {
            "endby": {
                "type": "after",
                "after": 3
            },
            byday: user.profile.prefs && user.profile.prefs.defaultWorkWeek || undefined,
            every: 1
        }
    };


    if (campaignId) {
        event.campaign = campaignId;
    }
    var eventDoc = new Event(event);

    // repopulate idea
    eventDoc.idea = idea;

    return  eventDoc;
};


actMgr.deleteEvent = function(eventId, user, i18n, cb) {
    Event
        .findById(eventId)
        .populate('idea')
        .populate('owner joiningUsers', '+profile +email')
        .exec(function (err, event) {

            if (err) {
                return cb(err);
            }
            if (!event) {
                return cb(new error.ResourceNotFoundError('Event not found.', {
                    id: eventId
                }));
            }
            var joiner = _.find(event.joiningUsers, function (joiningUser) {
                return joiningUser.equals(user);
            });

            var sysadmin = auth.checkAccess(user, auth.accessLevels.al_systemadmin);

            var owner = event.owner._id.equals(user._id);

            // event can be deleted if user is systemadmin or if it is his own event or if the user is a joiner
            if (!(sysadmin || owner || joiner)) {
                return cb(new error.NotAuthorizedError());
            }

            if (event.deleteStatus === Event.notDeletableNoFutureEvents && !sysadmin) {
                // if this is not deletable because of no future occurences we have in fact
                // nothing to do, we just pretend that we deleted all future occurences, by doing nothing
                // and signalling success
                actMgr.emit('event:eventDeleted', event);
                return cb();
            }

            function _deleteEvents(done) {
                if (sysadmin) {
                    _deleteOccurences(event, joiner, null, done);
                } else {
                    _deleteOccurences(event, joiner, new Date(), done);
                }
            }

            function _sendCalendarCancelMessages(done) {
                _sendIcalMessages(event, joiner, i18n, 'event cancelled', 'cancel', done);
            }

            function _deleteEvent(done) {

                if (joiner) {
                    event.joiningUsers.remove(user);
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
                        return error.handleError(err, cb);
                    }
                    if (joiner) {
                        actMgr.emit('event:participationCancelled', event, user);
                    } else {
                        actMgr.emit('event:eventDeleted', event);
                    }
                    return cb();
                });
        });
};

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

function _sendIcalMessages(event, joiner, i18n, reason, type, done) {
    var users;
    if (joiner) {
        users = [joiner];
    } else {
        users = [event.owner].concat(event.joiningUsers);
    }

    mongoose.model('Profile').populate(users, {path: 'profile', model: 'Profile'}, function (err, populatedUsers) {
        async.forEach(populatedUsers, function (user, next) {
                if (user.profile.prefs.email.iCalInvites) {
                    var myIcalString = calendar.getIcalObject(event, user, type, i18n, reason).toString();
                    email.sendCalInvite(user, type, myIcalString, event, i18n, reason);
                }
                return next();
            },
            done);
    });
}


actMgr.on('event:eventCreated', function (event, user) {

    // find and dismiss all recommendations for this idea
    SocialInteraction.dismissRecommendations(event.idea, user, { reason: 'eventScheduled'});
});

actMgr.on('event:eventSaved', function (event) {


});

actMgr.on('event:eventJoined', function (event, joinedUser) {

    SocialInteraction.dismissRecommendations(event.idea, joinedUser, { reason: 'eventJoined' }, handleError);
    SocialInteraction.dismissInvitations(event, joinedUser, { reason: 'eventJoined' }, handleError);

    // check whether we have reached the maxParticipants of this event
    if (event.joiningUsers && event.joiningUsers.length >= event.maxParticipants) {
        // we need to dismiss any public invitations, since we have reached the max of allowed people

        // TODO: IN-76 do not really delete, but mark as deleted
        SocialInteraction.deleteSocialInteractions(event, handleError );
    }
});


actMgr.on('event:eventDeleted', function (event) {
    SocialInteraction.deleteSocialInteractions(event, handleError);
});

actMgr.on('event:participationCancelled', function(event, user) {
   SocialInteraction.removeDismissals(event, user, handleError);

    // TODO: IN-76: check whether we need to resurrect an already filled up public invitation
});

actMgr.on('event:eventUpdated', function (updatedEvent) {
    Invitation.find({
            event: updatedEvent._id
        }
    ).exec(function (err, invitations) {

            var publicInvitationFound = false;

            _.forEach(invitations, function (invitation) {

                // if the flag "inviteOther" is not set and we find an existing public invitation
                // it needs to be removed
                if (invitation.targetSpaces[0].type === 'campaign' && !updatedEvent.inviteOthers) {
                    invitation.remove();
                } else {

                    // check whether this is the public invitation we need to assure that exists
                    if (invitation.targetSpaces[0].type === 'campaign') {
                        publicInvitationFound = true;
                    }

                    // The publishTo of the invitation has to be equal or earlier than the last occurence,
                    // it does not make sense to invite something that has already happened.
                    if (invitation.publishTo > updatedEvent.lastEventEnd) {
                        invitation.publishTo = updatedEvent.lastEventEnd;
                        invitation.save(function (err, saved) {
                            if (err) {
                                return actMgr.emit('error', err);
                            }
                        });
                    }
                }
            });

            if (updatedEvent.inviteOthers && !publicInvitationFound) {
                var publicInvitation  = {
                    author: updatedEvent.owner,
                    event: updatedEvent._id,
                    idea:  updatedEvent.idea,
                    authorType: 'user',
                    __t: 'Invitation',
                    publishFrom: new Date(),
                    publishTo: updatedEvent.end,
                    targetSpaces: [{
                        type: 'campaign',
                        targetId: INSPIRATION_CAMPAIGN_ID
                    }]
                };
                new Invitation(publicInvitation).save(function (err) {
                    if (err) {
                        log.error({err: err}, 'error saving invitation');
                        return actMgr.emit('error', err);
                    }
                });
            }
        });

});

function handleError(err) {
    if (err) {
        return actMgr.emit('error', err);
    }
}

actMgr.on('error', function (err) {
    log.error(err);
    throw new Error(err);
});


module.exports = actMgr;
