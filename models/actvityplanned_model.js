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
 * ActivityPlan Schema
 */
var ActivityPlanSchema = common.newSchema({
    owner: {type: ObjectId, ref: 'User', required: true},
    activity: {type: ObjectId, ref: 'Activity', required: true},
    title: {type: String},
    joiningUsers: [
        {type: ObjectId, ref: 'User'}
    ],
    location: {type: String},
    executionType: {type: String, enum: common.enums.executiontype},
    visibility: {type: String, enum: common.enums.visibility},
    status: {type: String, enum: common.enums.ActivityPlanStatus},
    campaign: {type: ObjectId, ref: 'Campaign'},
    topics: [String],
    fields: [String],
    masterPlan: {type: ObjectId, ref: 'ActivityPlan'},  // set to the joined ActivityPlan in case this is a "slave plan" of somebody joining another plan.
    mainEvent: {
        start: {type: Date},
        end: {type: Date},
        allDay: {type: Boolean},
        frequency: {type: String, enum: common.enums.ActivityPlanFrequency},
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


ActivityPlanSchema.pre('save', function (next) {
    var self = this;
    var model = mongoose.model('ActivityPlan');

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

            // the joiningUsers collection of the slavePlan is not saved, it should always remain empty because
            // it will be populated by the pre'init' function when loading the slavePlan
            self.joiningUsers = [];

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

/**
 * When we load an activityPlan we need to enrich it with data, that we do not store redundatly but is always needed
 * when displaying the ActivityPlan. The joiningUsers Array is maintained on the masterPlan and is copied to
 * the slavePlan on demand whenever we load a slave plan.
 */
ActivityPlanSchema.pre('init', function populateSlavePlans (next, data) {

    if (data.masterPlan) {
        var model = mongoose.model('ActivityPlan');

        // this is a slave plan, so we get the current data from its master
        model.findById(data.masterPlan)
            .populate('owner')
            .populate('joiningUsers')
            .exec(function (err, masterPlan) {
                if (err || !masterPlan) {
                    return next(err || new Error('masterPlan: ' + data.masterPlan + ' not found for slave: ' + data._id));
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

module.exports = mongoose.model('ActivityPlan', ActivityPlanSchema);


// initialize Activity DB if not initialized
common.initializeDbFor(mongoose.model('ActivityPlan'));
