/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common'),
    calendar = require('../util/calendar'),
    moment = require('moment');


/**
 * ActivityPlan Schema
 */
var ActivityPlanSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    idea: {type: ObjectId, ref: 'Idea', required: true},
    joiningUsers: [
        {type: ObjectId, ref: 'User'}
    ],
    title: {type: String, required: true},
    text: {type: String},
    number: {type: String},
    location: {type: String},
    executionType: {type: String, enum: common.enums.executiontype},
    status: {type: String, enum: common.enums.ActivityPlanStatus},
    campaign: {type: ObjectId, ref: 'Campaign'},
    fields: [String],
    deletionReason: {type: String},
    mainEvent: {
        start: {type: Date},
        end: {type: Date},
        allDay: {type: Boolean},
        frequency: {type: String, enum: common.enums.activityPlanFrequency},
        recurrence: {
            'endby': {
                type: {type: String, enum: common.enums.activityRecurrenceEndByType},
                on: {type: Date},
                after: Number
            },
            byday: [String],
            every: {type: Number},
            exceptions: [ Date]
        }
    }
});

ActivityPlanSchema.statics.activityPlanCompletelyDeletable = "deletable";
ActivityPlanSchema.statics.activityPlanOnlyFutureEventsDeletable = "deletableOnlyFutureEvents";
ActivityPlanSchema.statics.notDeletableNoFutureEvents = "notDeletableNoFutureEvents";

ActivityPlanSchema.statics.activityPlanEditable = "editable";
ActivityPlanSchema.statics.activityPlanNotEditableJoinedPlan = "notEditableJoinedPlan";
ActivityPlanSchema.statics.activityPlanNotEditableAllEventsInThePast = "notEditablePastEvent";

/**
 * Virtuals
 */

ActivityPlanSchema.virtual('deleteStatus')
    .get(function getDeleteStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.mainEvent.end).diff(this.mainEvent.start);

        var now = moment();
        // check if there are any events in the past, checking the first is enough!
        var eventsInThePastExist = moment(occurrences[0]).add('ms', duration).isBefore(now);

        // check if there are any events in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length -1]).add('ms', duration).isAfter(now);

        if (eventsInThePastExist && eventsInTheFutureExist) {
            return ActivityPlanSchema.statics.activityPlanOnlyFutureEventsDeletable;
        }
        else if (!eventsInTheFutureExist) {
            return ActivityPlanSchema.statics.notDeletableNoFutureEvents;
        } else if (!eventsInThePastExist) {
            return ActivityPlanSchema.statics.activityPlanCompletelyDeletable;
        } else {
            throw new Error('should not be possible');
        }
    });

ActivityPlanSchema.virtual('editStatus')
    .get(function getEditStatus() {
        var occurrences = calendar.getOccurrences(this);
        var duration = moment(this.mainEvent.end).diff(this.mainEvent.start);
        var now = moment();

        // check if there are any events in the past, checking whether the last one is already passed is enough!
        var eventsInTheFutureExist = moment(occurrences[occurrences.length -1]).add('ms', duration).isAfter(now);

        // activityPlan cannot be edited if all events are in the past
        if (!eventsInTheFutureExist) {
            return ActivityPlanSchema.statics.activityPlanNotEditableAllEventsInThePast;
        }

        // passed editable tests
        return ActivityPlanSchema.statics.activityPlanEditable;
    });


ActivityPlanSchema.virtual('firstEventStart')
    .get(function firstEventStart() {
        return calendar.getOccurrences(this)[0];
    });

ActivityPlanSchema.virtual('lastEventEnd')
    .get(function lastEventEnd() {
        var ocurrences = calendar.getOccurrences(this);
        var duration = moment(this.mainEvent.end).diff(this.mainEvent.start);
        return moment(ocurrences[ocurrences.length - 1]).add('ms', duration).toDate();
    });

ActivityPlanSchema.pre('save', function (next) {
    // force the internal version key to be incremented in save(), so we can reliably use it
    // as sequence number of iCal Objects generated for this plan
    this.increment();
    return next();
});

module.exports = mongoose.model('ActivityPlan', ActivityPlanSchema);
