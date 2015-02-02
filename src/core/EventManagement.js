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

function EventManagement() {
    EventEmitter.call(this);
}

util.inherits(EventManagement, EventEmitter);
var actMgr = new EventManagement();

/**
 * on change of a user's campaign
 *
 *  - schedule assessment event
 *
 */



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
            _.forEach(invitations, function (invitation) {

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
            });
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
