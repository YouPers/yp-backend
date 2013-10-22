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
    planType: {type: String, enum: common.enums.plantype},
    executionType: {type: String, enum: common.enums.executiontype},
    visibility: {type: String, enum: common.enums.visibility},
    onceDate: {type: Date},
    onceTime: {type: Date},
    dailyTime: {type: Date},
    status: {type: String, enum: common.enums.activityPlannedStatus},
    events: [ActivityPlanEvent]
});


mongoose.model('ActivityPlanned', ActivityPlannedSchema);

// initialize Activity DB if not initialized
var ActivityPlanned = mongoose.model('ActivityPlanned');
var Activity = mongoose.model('Activity');

console.log("ActivityPlanned: checking whether Database initialization is needed...");
ActivityPlanned.find().exec(function (err, allActivityPlanned) {
    if (err) {
        throw err;
    }
    if (allActivityPlanned.length === 0 ) {
        console.log("ActivityPlanned: initializing from File!");

        var filename = '../dbdata/ActivityPlanned.json';

        try {
            var plansFromFile = require(filename);
            plansFromFile.forEach(function(plan) {

                // match ActivtiyPlans to Activity by Id, because they are by number before...
                Activity.findOne({number: plan.activity.number}, function(err, activity) {
                    if (err) {
                        console.log(err);
                        throw err;
                    }
                    console.log(plan);
                    console.log(activity);
                    plan.activity = activity._id;
                    var newPlan = new ActivityPlanned(plan);
                    console.log(newPlan);
                    newPlan.save();
                });
            });

        } catch (Error) {
            console.log(Error);
        }

    } else {
        console.log("ActivityPlanned: no initialization needed, as we already have instances (" + allActivityPlanned.length + ")");
    }
});
