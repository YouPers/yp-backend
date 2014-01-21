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

ActivityPlanEvent.statics.getFieldDescriptions = function() {
    return {
        owner: 'The user who owns this ActivityPlanEvent'
    };
};

/**
 * Methods
 */

ActivityPlanSchema.methods = {
    // evaluate the delete Status
    evaluateDeleteStatus: function () {
        if (!this._id) {
            return "";
        }
        // activity plan cannot be deleted if there are joining users
        if (this.joiningUsers.length > 0) {
            return "ACTIVITYPLAN_DELETE_NO";
        }

        // check if there are any events in the past
        var eventsInThePastExist = false;
        var now = new Date();
        _.forEach(this.events, function(event) {
            if (event.begin < now || event.end < now){
                eventsInThePastExist = true;
            }
        });
        if (eventsInThePastExist === true) {
            // only future events are allowed to be deleted
            return "ACTIVITYPLAN_DELETE_ONLYFUTUREEVENTS";
        }

        // no joining users and no past events, thus the complete activity plan can be deleted
        return "ACTIVITYPLAN_DELETE_YES";
    }
};

/**
 * Virtuals
 */

ActivityPlanSchema.set('toObject', { virtuals: true});
ActivityPlanSchema.set('toJSON', { virtuals: true});

ActivityPlanSchema.virtual('deleteStatus')
    .get(function getDeleteStatus () {
        return this.evaluateDeleteStatus();
    });



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

ActivityPlanSchema.pre('init', function (next, data) {
    var model = mongoose.model('ActivityPlan');

    if (data.masterPlan) {
        // this is a slave plan, so we get the current data from its master
        model.findById(data.masterPlan, function (err, masterPlan) {
            if (err || !masterPlan) {
                return next(err || new Error('masterPlan: ' + data.masterPlan + ' not found for slave: ' + data._id));
            }

            // deal with the fact that owner can be a ref of Type ObjectId or a populated Object
            var ownerObjectId = data.owner._id || data.owner;
            // populate the joiningUsers from the masterPlan, because we do not save it on slaves
            _.forEach(masterPlan.joiningUsers, function(user) {
                if (!user.equals(ownerObjectId)){
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
        console.log(this.deleteStatus);
        return next();
    }
});

ActivityPlanSchema.pre('init', function checkDeleteStatus (next, data) {
    var model = mongoose.model('ActivityPlan');
    return next();
});

module.exports = mongoose.model('ActivityPlan', ActivityPlanSchema);


// initialize Activity DB if not initialized
common.initializeDbFor(mongoose.model('ActivityPlan'));
