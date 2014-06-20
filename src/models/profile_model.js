/**
 * Created by irig on 13.01.14.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    common = require('./common');

/**
 * Profile Schema
 */
var ProfileSchema = common.newSchema({
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gender: { type: String, enum: common.enums.gender, default: "undefined" },
    birthDate: { type: Date },
    campaign: {type:  Schema.Types.ObjectId, ref:'Campaign'},
    homeAddress: {
        street: { type: String, trim: true },
        houseNumber: { type: String, trim: true },
        zipCode: { type: Number },
        city: { type: String, trim: true },
        country: { type: String, enum: common.enums.country }
    },
    workAddress: {
        street: { type: String, trim: true },
        houseNumber: { type: String, trim: true },
        zipCode: { type: Number },
        city: { type: String, trim: true },
        country: { type: String, trim: true }
    },
    maritalStatus: { type: String, enum: common.enums.maritalStatus, default: "undefined" },
    language: { type: String, trim: true},
    userPreferences: {
        defaultUserWorkWeek: [String],
        personalGoal: {type: String},
        focus: [
            {
                timestamp: {type: Date},
                question: {type: ObjectId, ref: 'AssessmentQuestion'}
            }
        ],
        starredActivities: [
            {
                timestamp: {type: Date},
                activity: {type: ObjectId, ref: 'Activity'}
            }
        ],
        rejectedActivities: [
            {
                timestamp: {type: Date},
                activity: {type: ObjectId, ref: 'Activity'}
            }
        ],
        rejectedActivityPlans: [
            {
                timestamp: {type: Date},
                activityPlan: {type: ObjectId, ref: 'ActivityPlan'}
            }
        ],
        firstDayOfWeek: { type: String, enum: common.enums.firstDayOfWeek },
        timezone: { type: String, trim: true },
        calendarNotification: {type: String, enum: common.enums.calendarNotifications, default: '900'},
        email: {
            iCalInvites: { type: Boolean, default: true },
            actPlanInvites: { type: Boolean, default: true },
            dailyUserMail: { type: Boolean, default: true }
        },
        lastDiaryEntry: {type: Date},
        doNotAskAgainForDiaryEntry: { type: Boolean, default: false }
    }

});

ProfileSchema.plugin(require('mongoose-eventify'));

module.exports = mongoose.model('Profile', ProfileSchema);
