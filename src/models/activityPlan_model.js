/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common'),
    error = require('../util/error'),
    _ = require('lodash');
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
    comment: {type: String}

});

mongoose.model('ActivityPlanEvent', ActivityPlanEvent);
/**
 * ActivityPlan Schema
 */
var ActivityPlanSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    activity: {type: ObjectId, ref: 'Activity', required: true},
    joiningUsers: [
        {type: ObjectId, ref: 'User'}
    ],
    title: {type: String, required: true},
    text: {type: String},
    number: {type: String},
    location: {type: String},
    source: { type: String, enum: common.enums.source},
    executionType: {type: String, enum: common.enums.executiontype},
    visibility: {type: String, enum: common.enums.visibility},
    status: {type: String, enum: common.enums.ActivityPlanStatus},
    campaign: {type: ObjectId, ref: 'Campaign'},
    fields: [String],
    masterPlan: {type: ObjectId, ref: 'ActivityPlan'},  // set to the joined ActivityPlan in case this is a "slave plan" of somebody joining another plan.
    deletionReason: {type: String},
    invitedBy: {type: ObjectId, ref: 'User'},
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
            every: {type: Number},
            exceptions: [
                {type: Date}
            ]
        }

    },
    events: [ActivityPlanEvent]
});

ActivityPlanEvent.statics.getFieldDescriptions = function () {
    return {
        owner: 'The user who owns this ActivityPlanEvent'
    };
};

ActivityPlanSchema.statics.activityPlanCompletelyDeletable = "deletable";
ActivityPlanSchema.statics.activityPlanOnlyFutureEventsDeletable = "deletableOnlyFutureEvents";
ActivityPlanSchema.statics.notDeletableNoFutureEvents = "notDeletableNoFutureEvents";

ActivityPlanSchema.statics.activityPlanEditable = "editable";
ActivityPlanSchema.statics.activityPlanNotEditableJoinedPlan = "notEditableJoinedPlan";
ActivityPlanSchema.statics.activityPlanNotEditableAllEventsInThePast = "notEditablePastEvent";

/**
 * Methods
 */

ActivityPlanSchema.methods = {
    // evaluate the delete Status
    evaluateDeleteStatus: function () {
        var now = new Date();
        // check if there are any events in the past
        var eventsInThePastExist = _.any(this.events, function(event) {
            return event.end < now;
        });
        var eventsInTheFutureExist = _.any(this.events, function(event) {
            return event.end > now;
        });
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
    },
    evaluateEditStatus: function () {

        // a joined activity plan cannot be edited
        if (this.masterPlan && this.masterPlan.toString().length > 0) {
            return ActivityPlanSchema.statics.activityPlanNotEditableJoinedPlan;
        }

        // activity plan cannot be edited if all events are in the past
        var now = new Date();
        if (_.every(this.events, function(event) {
            return event.end < now;
        })) {
            return ActivityPlanSchema.statics.activityPlanNotEditableAllEventsInThePast;
        }

        // passed editable tests
        return ActivityPlanSchema.statics.activityPlanEditable;
    }
};

/**
 * Virtuals
 */


ActivityPlanSchema.virtual('deleteStatus')
    .get(function getDeleteStatus() {
        return this.evaluateDeleteStatus();
    });

ActivityPlanSchema.virtual('editStatus')
    .get(function getEditStatus() {
        return this.evaluateEditStatus();
    });


ActivityPlanSchema.pre('save', function (next) {
    var self = this;
    var model = mongoose.model('ActivityPlan');

    // force the internal version key to be incremented in save(), so we can reliably use it
    // as sequence number of iCal Objects generated for this plan
    //self.increment();

    // if this is a slave Plan, we need to update the master plan
    if (self.masterPlan) {
        // load the master Plan
        model.findById(self.masterPlan, function (err, masterPlan) {
            var modifiedMaster = false;

            if (!masterPlan) {
                return next(new error.ResourceNotFoundError('MasterPlan not found.', { id: self.masterPlan }));
            }

            if (self.owner && self.owner._id) {
                self.owner = self.owner._id;
            }

            if (masterPlan.owner === self.owner) {
                return next(new error.NotAuthorizedError('A user cannot join his own activityPlan.', {
                    owner: self.owner,
                    activityPlanId: self.masterPlan
                }));
            }

            // we check whether we need to update the joiningUsers collection of the masterPlan
            if (!_.find(masterPlan.joiningUsers, function (joiningUser) {
                return joiningUser.equals(self.owner);
            })) {
                masterPlan.joiningUsers.push(self.owner.toJSON());
                modifiedMaster = true;
            }

            // the joiningUsers collection of the slavePlan is not saved, it should always remain empty because
            // it will be populated by the pre'init' function when loading the slavePlan
            self.joiningUsers = [];

            if (modifiedMaster) {
                masterPlan.save(function (err) {
                    if (err) {
                        return error.handleError(err, next);
                    } else {
                        return next();
                    }
                });
            } else {
                return next();
            }
        });

    }

    return next();
});

/**
 * When we load an activityPlan we need to enrich it with data, that we do not store redundatly but is always needed
 * when displaying the ActivityPlan. The joiningUsers Array is maintained on the masterPlan and is copied to
 * the slavePlan on demand whenever we load a slave plan.
 */
ActivityPlanSchema.pre('init', function populateSlavePlans(next, data) {

    if (data.masterPlan) {
        var model = mongoose.model('ActivityPlan');

        // this is a slave plan, so we get the current data from its master
        model.findById(data.masterPlan)
            .populate('owner', '+email')
            .populate('joiningUsers', '+email')
            .exec(function (err, masterPlan) {
                if (err) {
                    return next(error.handleError(err, next));
                }

                if (!masterPlan) {
                    return next(new error.ResourceNotFoundError('MasterPlan not found for SlavePlan.', {
                        masterPlanId: data.masterPlan,
                        slavePlanId: data._id
                    }));
                }

                // deal with the fact that owner can be a ref of Type ObjectId or a populated Object
                var ownerObjectId = data.owner._id || data.owner;

                // populate the joiningUsers from the masterPlan, because we do not save it on slaves
                _.forEach(masterPlan.joiningUsers, function (user) {
                    if (!user._id.equals(ownerObjectId)) {
                        data.joiningUsers.push(user);
                    }
                });
                // add the owner of the master
                data.joiningUsers.unshift(masterPlan.owner);

                return next();
            });
    } else {
        return next();
    }
});

module.exports = mongoose.model('ActivityPlan', ActivityPlanSchema);
