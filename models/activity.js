/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 15.10.13
 * Time: 17:08
 * To change this template use File | Settings | File Templates.
 */
/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

// enumerations used in activity object
var source = "youpers community campaign".split(' ');
var plantype = "daily weekly once".split(' ');
var executiontype = "self group".split(' ');
var visibility = "private campaign public".split(' ');
//var field  = "AwarenessAbility Relaxation TimeManagement SocialInteraction WorkStructuring Breaks PhysicalActivity LeisureActivity Nutrition".split(' ');
//var topic = "workLifeBalance";

/**
 * Activity Schema
 */
var ActivitySchema = new Schema({
    id: ObjectId,
    number: {type: String, trim: true, required: true},
    title: { type: String, trim: true, required: true },
    source: { type: String, enum: source},
    defaultplantype: {type: String, enum: plantype},
    defaultexecutiontype: {type: String, enum: executiontype},
    defaultvisibility: {type: String, enum: visibility},
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