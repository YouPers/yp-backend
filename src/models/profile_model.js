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
        defaultUserWeekForScheduling: {
            monday: { type: Boolean, default: true },
            tuesday: { type: Boolean, default: true },
            wednesday: { type: Boolean, default: true },
            thursday: { type: Boolean, default: true },
            friday: { type: Boolean, default: true },
            saturday: { type: Boolean, default: false },
            sunday: { type: Boolean, default: false  }
        },
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

ProfileSchema.methods.getWorkingDaysAsIcal = function () {
    var iCalArray = [];
    if (this.userPreferences.defaultUserWeekForScheduling.monday) {
        iCalArray.push('MO');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.tuesday) {
        iCalArray.push('TU');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.wednesday) {
        iCalArray.push('WE');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.thursday) {
        iCalArray.push('TH');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.friday) {
        iCalArray.push('FR');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.saturday) {
        iCalArray.push('SA');
    }
    if (this.userPreferences.defaultUserWeekForScheduling.sunday) {
        iCalArray.push('SU');
    }
    return iCalArray.join(',');
};

module.exports = mongoose.model('Profile', ProfileSchema);
