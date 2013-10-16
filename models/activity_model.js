/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Activity Schema
 */
var ActivitySchema = new Schema({
    id: ObjectId,
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true, required: true },
    source: { type: String, enum: common.enums.source},
    defaultplantype: {type: String, enum: common.enums.plantype},
    defaultexecutiontype: {type: String, enum: common.enums.executiontype},
    defaultvisibility: {type: String, enum: common.enums.visibility},
    topic: [String],
    field: [String]
});


mongoose.model('Activity', ActivitySchema);

// initialize Activity DB if not initialized
var Activity = mongoose.model('Activity');
console.log("Activity: checking whether Database initialization is needed...");
Activity.find().exec(function (err, activities) {
    if (err) {
        throw err;
    }
    if (activities.length === 0 ) {
        console.log("initializing activity Database from File!");
        var activitiesFromFile = require('../dbdata/activity.json');
        activitiesFromFile.forEach(function(activity) {
           var newAct = new Activity(activity);
            newAct.save();
        });
    } else {
        console.log("Activity: no initialization needed, as we already have activities (" + activities.length + ")");
    }
});