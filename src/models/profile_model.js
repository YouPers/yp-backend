/**
 * Created by irig on 13.01.14.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    common = require('./common');

/**
 * Profile Schema
 */
var ProfileSchema = common.newSchema( {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: {type: Date},
    gender: { type: String, enum: common.enums.gender, default: "undefined" },
    birthDate: { type: Date },
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
        firstDayOfWeek: { type: String, enum: common.enums.firstDayOfWeek },
        languageUI: { type: String, enum: common.enums.languageUI },
        timezone: { type: String, trim: true },
        calendarNotification: {type: String, enum: common.enums.calendarNotifications, default: '15M'},
        email: {
            iCalInvites: { type: Boolean, default: true },
            actPlanInvites: { type: Boolean, default: true },
            dailyUserMail: { type: Boolean, default: true }
        }
    }

});

module.exports = mongoose.model('Profile', ProfileSchema);

common.initializeDbFor(mongoose.model('Profile'));