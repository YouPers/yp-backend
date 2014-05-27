var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    _ = require('lodash'),
    ical = require('icalendar'),
    moment = require('moment');

var getIcalObject = function (plan, recipientUser, iCalType, i18n, reason) {

    // fix for non existing plan.text
    if (_.isUndefined(plan.text)) {
        plan.text = "";
    }

    var myCal = new ical.iCalendar();
    var event = new ical.VEvent(plan._id);
    event.addProperty("ORGANIZER", "MAILTO:dontreply@youpers.com", {CN: "YouPers Digital Health"});
    myCal.addProperty("CALSCALE", "GREGORIAN");
    event.addProperty("ATTENDEE",
            "MAILTO:" + recipientUser.email,
        {CUTYPE: "INDIVIDUAL", ROLE: "REQ-PARTICIPANT", PARTSTAT: "NEEDS-ACTION", CN: recipientUser.fullname, "X-NUM-GUESTS": 0 });

    if (iCalType === 'new' || iCalType === 'update') {
        myCal.addProperty("METHOD", "REQUEST");
        event.addProperty("STATUS", "CONFIRMED");
        event.addProperty("SEQUENCE", 0);
    } else if (iCalType === 'cancel') {
        myCal.addProperty("METHOD", "CANCEL");
        event.addProperty("STATUS", "CANCELLED");
        event.addProperty("SEQUENCE", 1);
    } else if (iCalType === 'eventsGenerationOnly') {
        // do nothing here, we do not these properties if we only need the object for eventsGeneration
    }
    else {
        throw new Error('unknown iCal ObjectType: ' + iCalType);
    }

    if (iCalType !== 'eventsGenerationOnly') {
        // these properties are not needed for events-generation, so we don't set them
        var link = config.webclientUrl + "/#/activities/" + plan.activity._id;

        event.setSummary(i18n.t('ical:' + iCalType + ".summary", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON()}));
        event.setDescription(i18n.t('ical:' + iCalType + ".description", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON(), link: link}));
        // HTML in description: see here: http://www.limilabs.com/blog/html-formatted-content-in-the-description-field-of-an-icalendar
        event.addProperty("X-ALT-DESC",
            i18n.t('ical:' + iCalType + ".htmlDescription",
                {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON(), link: link}),
            {'FMTTYPE': 'text/html'});
        event.addProperty("LOCATION", plan.location);
        var notifPref = recipientUser.profile.userPreferences.calendarNotification || "900";
        if (notifPref !== 'none') {
            var alarm = event.addComponent('VALARM');
            alarm.addProperty("ACTION", "DISPLAY");
            alarm.addProperty("TRIGGER", -1 * notifPref);
            alarm.addProperty("DESCRIPTION", i18n.t('ical:' + iCalType + ".summary", {plan: plan.toJSON ? plan.toJSON() : plan, recipient: recipientUser.toJSON()}));
        }
    }

    var fromDate = moment(plan.mainEvent.start).toDate();
    var toDate = moment(plan.mainEvent.end).toDate();
    fromDate.dateTimeMode = 'floating';
    toDate.dateTimeMode = 'floating';

    event.setDate(fromDate, toDate);
    log.debug("generated ical with From: " + moment(plan.mainEvent.start).toDate());
    log.debug("generated ical with To: " + moment(plan.mainEvent.end).toDate());

    if (plan.mainEvent.recurrence && plan.mainEvent.frequency && plan.mainEvent.frequency !== 'once') {
        var frequencyMap = {
            'day': 'DAILY',
            'week': 'WEEKLY',
            'month': 'MONTHLY'
        };
        if (!frequencyMap[plan.mainEvent.frequency]) {
            throw new Error("unknown recurrence frequency");
        }

        var rruleSpec = { FREQ: frequencyMap[plan.mainEvent.frequency] };
        if (rruleSpec.FREQ === 'DAILY') {
            rruleSpec.BYDAY = recipientUser.profile.getWorkingDaysAsIcal();
        }


        if (plan.mainEvent.recurrence.endby.type === 'on') {
            rruleSpec.UNTIL = plan.mainEvent.recurrence.endby.on;
        } else if (plan.mainEvent.recurrence.endby.type === 'after') {
            rruleSpec.COUNT = plan.mainEvent.recurrence.endby.after;
        }

        event.addProperty("RRULE", rruleSpec);
    }
    event.addProperty("TRANSP", "OPAQUE");
    myCal.addComponent(event);
    return myCal;
};

module.exports = {
    getIcalObject: getIcalObject
};
