/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('ypbackendlib').commmonModels,
    calendar = require('../util/calendar'),
    moment = require('moment'),
    enums = require('./enums');


/**
 * Event Schema
 */
var EventSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    idea: {type: ObjectId, ref: 'Idea', required: true},
    joiningUsers: [
        {type: ObjectId, ref: 'User'}
    ],
    title: {type: String, required: true},
    text: {type: String},
    number: {type: String},
    location: {type: String},
    executionType: {type: String, enum: enums.executiontype},
    status: {type: String, enum: enums.EventStatus, required: true},
    campaign: {type: ObjectId, ref: 'Campaign'},
    deletionReason: {type: String},
    start: {type: Date, required: true},
    end: {type: Date, required: true},
    allDay: {type: Boolean},
    frequency: {type: String, enum: enums.eventFrequency},
    minParticipants: {type: Number, required: false},
    maxParticipants: {type: Number, required: false},
    loc: {type: [Number], index: '2d'},
    recurrence: {
        'endby': {
            type: {type: String, enum: enums.eventRecurrenceEndByType},
            on: {type: Date},
            after: Number
        },
        byday: [String],
        every: {type: Number},
        exceptions: [Date]
    }
});

// need to figure out how missing attributes are treated, see here:
// http://stackoverflow.com/questions/16388836/does-applying-a-2dsphere-index-on-a-mongoose-schema-force-the-location-field-to
// https://github.com/LearnBoost/mongoose/issues/1668
// https://github.com/LearnBoost/mongoose/commit/6d69fea155449ceab4281bf474a7ed7ea0430f78

// EventSchema.index({loc: '2dsphere'});

EventSchema.methods = {

    toJsonConfig: function () {
        return {
            include: ['deleteStatus', 'editStatus', 'inviteOthers']
        };
    }

};

EventSchema.statics.eventCompletelyDeletable = "deletable";
EventSchema.statics.eventOnlyFutureEventsDeletable = "deletableOnlyFutureEvents";
EventSchema.statics.notDeletableNoFutureEvents = "notDeletableNoFutureEvents";

EventSchema.statics.eventEditable = "editable";
EventSchema.statics.eventNotEditableJoined = "notEditableJoined";
EventSchema.statics.eventNotEditableAllEventsInThePast = "notEditablePastEvent";

/**
 * Virtuals
 */

EventSchema.virtual('deleteStatus')
    .get(function getDeleteStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);

        var now = moment();
        // check if there are any occurences in the past, checking the first is enough!
        var eventsInThePastExist = moment(occurrences[0]).add(duration, 'ms').isBefore(now);

        // check if there are any occurences in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length - 1]).add(duration, 'ms').isAfter(now);

        if (eventsInThePastExist && eventsInTheFutureExist) {
            return EventSchema.statics.eventOnlyFutureEventsDeletable;
        }
        else if (!eventsInTheFutureExist) {
            return EventSchema.statics.notDeletableNoFutureEvents;
        } else if (!eventsInThePastExist) {
            return EventSchema.statics.eventCompletelyDeletable;
        } else {
            throw new Error('should not be possible');
        }
    });

EventSchema.virtual('editStatus')
    .get(function getEditStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);
        var now = moment();

        // check if there are any occurences in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length - 1]).add(duration, 'ms').isAfter(now);

        // event cannot be edited if all occurences are in the past
        if (!eventsInTheFutureExist) {
            return EventSchema.statics.eventNotEditableAllEventsInThePast;
        }

        // passed editable tests
        return EventSchema.statics.eventEditable;
    });


EventSchema.virtual('firstEventStart')
    .get(function firstEventStart() {
        return calendar.getOccurrences(this)[0];
    });

EventSchema.virtual('lastEventEnd')
    .get(function lastEventEnd() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);
        return moment(occurrences[occurrences.length - 1]).add(duration, 'ms').toDate();
    });

EventSchema.pre('save', function (next) {
    // force the internal version key to be incremented in save(), so we can reliably use it
    // as sequence number of iCal Objects generated for this event
    this.increment();
    return next();
});


EventSchema.pre('init', function (next, data) {
    // check whether this event is shared to others and set the flag if yes
    mongoose.model('Invitation')
        .find({event: data._id, targetSpaces: {$elemMatch: {type: 'campaign'}}})
        .exec(function (err, invs) {
            if (err) {
                return next(err);
            }
            if (invs && invs.length === 1) {
                data.inviteOthers = true;
            }
            return next();
        });
});

module.exports = mongoose.model('Event', EventSchema);
