var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('ypbackendlib').mongoose;
var _ = require('lodash');
var moment = require('moment');
var calendar = require('../util/calendar');
var User = mongoose.model('User');
var Invitation = mongoose.model('Invitation');
var Idea = mongoose.model('Idea');
var Campaign = mongoose.model('Campaign');
var Assessment = mongoose.model('Assessment');
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

User.on('change:campaign', function (user) {

    Campaign.findById(user.campaign).exec(function (err, campaign) {
        if (err) {
            handleError(err);
        }

        Assessment.find({ topic: campaign.topic }).exec(function (err, assessments) {
            if (err) {
                handleError(err);
            }

            if (assessments.length !== 1) {
                return actMgr.emit('error', 'assessment for topic not found or not unique');
            }
            var assessment = assessments[0];
            if (assessment.idea) {

                Event.find({
                    owner: user._id,
                    idea: assessment.idea,
                    status: 'active'
                }).exec(function (err, activities) {
                    if (err) {
                        handleError(err);
                    }

                    // only plan assessment idea if there is no active event yet
                    if (activities.length === 0) {

                        mongoose.model('Profile').findById(user.profile).exec(function (err, profile) {
                            if (err) {
                                handleError(err);
                            }

                            Idea.findById(assessment.idea).select(Idea.getI18nPropertySelector(profile.language)).exec(function (err, idea) {
                                if (err) {
                                    return handleError(err);
                                }
                                var assessmentEvent = actMgr.defaultEvent(idea, user);
                                assessmentEvent.mainEvent.start = new Date();
                                assessmentEvent.mainEvent.end = moment(assessmentEvent.mainEvent.start).add(15, 'm').toDate();
                                assessmentEvent.save(function (err, savedEvent) {
                                    if (err) {
                                        return handleError(err);
                                    }
                                    var occurences = actMgr.getOccurences(savedEvent, user.id);
                                    Occurence.create(occurences, function (err) {
                                        if (err) {
                                            return handleError(err);
                                        }
                                        actMgr.emit('event:eventCreated', savedEvent, user);
                                    });
                                });

                            });


                        });
                    }
                });

            }
        });

    });
});

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

    var duration = moment(event.mainEvent.end).diff(event.mainEvent.start);

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
    var mainEvent = {
        "allDay": false
    };
    var duration = idea.defaultduration ? idea.defaultduration : 60;

    mainEvent.start = moment(now).add(1, 'd').startOf('hour').toDate();
    mainEvent.end = moment(mainEvent.start).add(duration, 'm').toDate();
    mainEvent.frequency = idea.defaultfrequency;
    mainEvent.recurrence = {
        "endby": {
            "type": "after",
            "after": 3
        },
        byday: user.profile.prefs && user.profile.prefs.defaultWorkWeek || undefined,
        every: 1
    };

    if (!campaignId && user.campaign) {
        campaignId = user.campaign._id || user.campaign;
    }

    var event = {
        owner: user._id || user,
        idea: idea,
        status: 'active',
        mainEvent: mainEvent,
        executionType: idea.defaultexecutiontype,
        fields: idea.fields,
        topics: idea.topics,
        title: idea.title,
        number: idea.number
    };

    if (campaignId) {
        event.campaign = campaignId;
    }
    var eventModel = new Event(event);

    // repopulate idea
    eventModel.idea = idea;

    return  eventModel;
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

});


actMgr.on('event:eventDeleted', function (event) {
    SocialInteraction.deleteSocialInteractions(event, handleError);
});

actMgr.on('event:eventUpdated', function (updatedEvent) {
    Invitation.find({
            refDocs: { $elemMatch: { docId: updatedEvent._id, model: 'Event' }}
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
