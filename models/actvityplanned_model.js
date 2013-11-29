/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common'),
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
    comments: [
        {type: ObjectId, ref: 'Comment'}
    ]
});

/**
 * ActivityPlanned Schema
 */
var ActivityPlannedSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    activity: {type: ObjectId, ref: 'Activity', required: true},
    joiningUsers: [
        {type: ObjectId, ref: 'User'}
    ],
    executionType: {type: String, enum: common.enums.executiontype},
    visibility: {type: String, enum: common.enums.visibility},
    status: {type: String, enum: common.enums.activityPlannedStatus},
    campaign: {type: ObjectId, ref: 'Campaign'},
    topics: [String],
    fields: [String],
    masterPlan: {type: ObjectId, ref: 'ActivityPlanned'},  // set to the joined ActivityPlan in case this is a "slave plan" of somebody joining another plan.
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
            exceptions: [
                {type: Date}
            ]
        }

    },
    events: [ActivityPlanEvent]
});

ActivityPlannedSchema.pre('save', function (next) {
    var self = this;
    var model = mongoose.model('ActivityPlanned');

    // if this is a slave Plan, we need to update the master plan
    if (self.masterPlan) {
        // load the master Plan
        model.findById(self.masterPlan, function (err, masterPlan) {
            var modifiedMaster = false;

            if (!masterPlan) {
                return next(new Error('Cannot join ActivityPlan, plan not found: ' + self.masterPlan));
            }

            if (masterPlan.owner === self.owner) {
                return next(new Error('user cannot join his own ActivityPlan'));
            }

            // we check whether we need to update the joiningUsers collection of the masterPlan
            if (_.indexOf(masterPlan.joiningUsers, self.owner) === -1) {
                masterPlan.joiningUsers.push(self.owner.toJSON());
                modifiedMaster = true;
            }

            // if there exists eventComment in this plan, it must be moved to the master
            _.forEach(self.events, function (event) {
                _.forEach(event.comments, function (comment) {
                    var masterEvent = _.find(masterPlan.events, function (masterEventCand) {
                        return (masterEventCand.begin.toJSON() === event.begin.toJSON());
                    });
                    if (!masterEvent) {
                        return next(new Error('masterEvent not found for event: ' + event.id + ' in Plan ' + masterPlan.id));
                    }
                    masterEvent.comments.push(comment);
                    modifiedMaster = true;
                });
                event.comments = [];
            });

            if (modifiedMaster) {
                masterPlan.save(function (err) {
                    if (err) {
                        return next(err);
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


ActivityPlannedSchema.pre('init', function (next, data) {
    var model = mongoose.model('ActivityPlanned');

    if (data.masterPlan) {
        // this is a slave plan, so we get the current data from its master
        model.findById(data.masterPlan, function (err, masterPlan) {
            if (err || !masterPlan) {
                return next(err || new Error('masterPlan: ' + data.masterPlan + ' not found for slave: ' + data._id));
            }

            // populate the joiningUsers from the masterPlan, because we do not save it on slaves
            _.forEach(masterPlan.joiningUsers, function(user) {
                if (!user.equals(data.owner)){
                    data.joiningUsers.push(user);
                }
            });
            // add the owner of the master
            data.joiningUsers.push(masterPlan.owner);

            // populate the comments from the masterPlan, because we do not save the event comments on the slave plan
            _.forEach(masterPlan.events, function (masterEvent) {
                _.find(data.events, function (slaveEvent) {
                    if (slaveEvent.begin === masterEvent.begin) {
                        slaveEvent.comments = masterEvent.comments;
                    }
                });
            });
            return next();
        });
    } else {
        return next();
    }
});

mongoose.model('ActivityPlanned', ActivityPlannedSchema);


// initialize Activity DB if not initialized
common.initializeDbFor(mongoose.model('ActivityPlanned'));
