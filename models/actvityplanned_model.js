/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * ActivityPlanEvent Schema
 * @type {Schema}
 */
var ActivityPlanEvent = common.newSchema({
    status: {type: String, enum: common.enums.activityPlanEventStatus},
    begin: {type: Date},
    end: {type: Date},
    doneTs: {type: Date},
    feedback: {type: Number},
    comments: [{type: ObjectId, ref: 'Comment'}]
});


/**
 * ActivityPlanned Schema
 */
var ActivityPlannedSchema =  common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    activity: {type: ObjectId, ref: 'Activity', required: true},
    joiningUsers: [{type: ObjectId, ref: 'User'}],
    executionType: {type: String, enum: common.enums.executiontype},
    visibility: {type: String, enum: common.enums.visibility},
    status: {type: String, enum: common.enums.activityPlannedStatus},
    mainEvent: {
        start: {type: Date},
        end: {type: Date},
        allDay: {type: Boolean},
        frequency: {type: String, enum: common.enums.activityPlannedFrequency},
        recurrence: {
            'end-by': {
                type: {type: String, enum: common.enums.activityRecurrenceEndByType},
                on: {type: Date},
                after: Number
            },
            every: {type: Number},
            exceptions: [{type: Date}]
        }

    },
    events: [ActivityPlanEvent]
});


mongoose.model('ActivityPlanned', ActivityPlannedSchema);

// initialize Activity DB if not initialized
common.initializeDbFor(mongoose.model('ActivityPlanned'));
