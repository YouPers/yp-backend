/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');


/**
 * Activity Schema
 */

var question = new Schema({
    "category": String,
    "title": String,
    "type": {type: String, enum: common.enums.questionType},
    "mintext": String,
    "midtext": String,
    "maxtext": String,
    "exptext": String
});


var AssessmentSchema = new Schema({
    name: {type: String, trim: true, required: true},
    questionCats: [{ category: String,
        questions: [question]}]
});


mongoose.model('Assessment', AssessmentSchema);


// initialize Assessment DB if not initialized
var Assessment = mongoose.model('Assessment');
console.log("Assessment: checking whether Database initialization is needed...");
Assessment.find().exec(function (err, assessments) {
    if (err) {
        throw err;
    }
    if (assessments.length === 0) {
        console.log("Assessment: initializing assessment Database from File!");
        var assessmentFromFile = require('../dbdata/assessment.json');
        console.log(assessmentFromFile);
        var newAss = new Assessment(assessmentFromFile);
        console.log(newAss);
        newAss.save(function(err) {
            if (err) {
                console.log(err.message);
            }
        });
    } else {
        console.log("Assessment: no initialization needed, as we already have entities (" + assessments.length + ")");
    }
});