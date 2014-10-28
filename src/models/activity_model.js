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
 * Activity Schema
 */
var ActivitySchema = common.newSchema({
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
    status: {type: String, enum: enums.ActivityStatus},
    campaign: {type: ObjectId, ref: 'Campaign'},
    deletionReason: {type: String},
    start: {type: Date, required: true},
    end: {type: Date, required: true},
    allDay: {type: Boolean},
    frequency: {type: String, enum: enums.activityFrequency},
    recurrence: {
        'endby': {
            type: {type: String, enum: enums.activityRecurrenceEndByType},
            on: {type: Date},
            after: Number
        },
        byday: [String],
        every: {type: Number},
        exceptions: [ Date]
    }
});

ActivitySchema.methods = {

    toJsonConfig: {
        include: ['deleteStatus', 'editStatus']
    }

};

ActivitySchema.statics.activityCompletelyDeletable = "deletable";
ActivitySchema.statics.activityOnlyFutureEventsDeletable = "deletableOnlyFutureEvents";
ActivitySchema.statics.notDeletableNoFutureEvents = "notDeletableNoFutureEvents";

ActivitySchema.statics.activityEditable = "editable";
ActivitySchema.statics.activityNotEditableJoined = "notEditableJoined";
ActivitySchema.statics.activityNotEditableAllEventsInThePast = "notEditablePastEvent";

/**
 * Virtuals
 */

ActivitySchema.virtual('deleteStatus')
    .get(function getDeleteStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);

        var now = moment();
        // check if there are any events in the past, checking the first is enough!
        var eventsInThePastExist = moment(occurrences[0]).add(duration, 'ms').isBefore(now);

        // check if there are any events in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length - 1]).add(duration, 'ms').isAfter(now);

        if (eventsInThePastExist && eventsInTheFutureExist) {
            return ActivitySchema.statics.activityOnlyFutureEventsDeletable;
        }
        else if (!eventsInTheFutureExist) {
            return ActivitySchema.statics.notDeletableNoFutureEvents;
        } else if (!eventsInThePastExist) {
            return ActivitySchema.statics.activityCompletelyDeletable;
        } else {
            throw new Error('should not be possible');
        }
    });

ActivitySchema.virtual('editStatus')
    .get(function getEditStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);
        var now = moment();

        // check if there are any events in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length - 1]).add(duration, 'ms').isAfter(now);

        // activity cannot be edited if all events are in the past
        if (!eventsInTheFutureExist) {
            return ActivitySchema.statics.activityNotEditableAllEventsInThePast;
        }

        // passed editable tests
        return ActivitySchema.statics.activityEditable;
    });


ActivitySchema.virtual('firstEventStart')
    .get(function firstEventStart() {
        return calendar.getOccurrences(this)[0];
    });

ActivitySchema.virtual('lastEventEnd')
    .get(function lastEventEnd() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.end).diff(this.start);
        return moment(occurrences[occurrences.length - 1]).add(duration, 'ms').toDate();
    });

ActivitySchema.pre('save', function (next) {
    // force the internal version key to be incremented in save(), so we can reliably use it
    // as sequence number of iCal Objects generated for this activity
    this.increment();
    return next();
});

module.exports = mongoose.model('Activity', ActivitySchema);
