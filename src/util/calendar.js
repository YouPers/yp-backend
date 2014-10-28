var config = require('../config/config'),
    log = require('ypbackendlib').log(config),
    _ = require('lodash'),
    ical = require('icalendar'),
    moment = require('moment-timezone'),
    CET_TIMEZONE_ID = "Europe/Zurich",
    urlComposer = require('./urlcomposer');

var frequencyMap = {
    'day': 'DAILY',
    'week': 'WEEKLY',
    'month': 'MONTHLY'
};


var getIcalObject = function (activity, recipientUser, iCalType, i18n, reason) {

    // fix for non existing activity.text
    if (_.isUndefined(activity.text)) {
        activity.text = "";
    }

    var isGroupPlan = activity.executionType === 'group';

    var myCal = new ical.iCalendar();
    myCal.addProperty("CALSCALE", "GREGORIAN");
    myCal.addComponent(_getTimezone(activity));

    var iCalEventId =  activity._id;
    var event = new ical.VEvent(iCalEventId);

    var sequence = activity.__v;
    event.addProperty("SEQUENCE", sequence);

    if (isGroupPlan) {

        // Organizer and attendees are only relevant for group plans
        var organizer = activity.owner;
        var targetAttendee = recipientUser;
        var otherAttendees = activity.joiningUsers.slice(1);

        event.addProperty("ORGANIZER", "MAILTO:" + organizer.email, {CN: organizer.fullname});

        event.addProperty("ATTENDEE",
                "MAILTO:" + targetAttendee.email,
            {CUTYPE: "INDIVIDUAL", RSVP: "TRUE", ROLE: "REQ-PARTICIPANT", PARTSTAT: "NEEDS-ACTION", CN: "You", "X-NUM-GUESTS": 0 });

        _.forEach(otherAttendees, function (attendee) {
            // make sure we only add the guy receiving this iCal one time
            if (attendee.email !== organizer.email && attendee.email !== targetAttendee.email) {
                event.addProperty("ATTENDEE",
                        "MAILTO:" + attendee.email,
                    {CUTYPE: "INDIVIDUAL", ROLE: "REQ-PARTICIPANT", PARTSTAT: "ACCEPTED", CN: attendee.fullname, "X-NUM-GUESTS": 0 });
            }
        });
    }

    if (iCalType === 'new' || iCalType === 'update') {
        myCal.addProperty("METHOD", "REQUEST");
        event.addProperty("STATUS", "CONFIRMED");
    } else if (iCalType === 'cancel') {
        myCal.addProperty("METHOD", "CANCEL");
        event.addProperty("STATUS", "CANCELLED");
    } else {
        throw new Error('unknown iCal ObjectType: ' + iCalType);
    }

    var link = urlComposer.activityUrl(activity.campaign, activity.idea.id || activity.idea , activity.id);

    event.setSummary(i18n.t('ical:' + iCalType + ".summary", {activity: activity.toJSON ? activity.toJSON() : activity, recipient: recipientUser.toJSON()}));
    event.setDescription(i18n.t('ical:' + iCalType + ".description", {activity: activity.toJSON ? activity.toJSON() : activity, recipient: recipientUser.toJSON(), link: link}));
    // HTML in description: see here: http://www.limilabs.com/blog/html-formatted-content-in-the-description-field-of-an-icalendar
    event.addProperty("X-ALT-DESC",
        i18n.t('ical:' + iCalType + ".htmlDescription",
            {activity: activity.toJSON ? activity.toJSON() : activity, recipient: recipientUser.toJSON(), link: link}),
        {'FMTTYPE': 'text/html'});
    event.addProperty("LOCATION", activity.location);
    var notifPref = recipientUser.profile.prefs.calendarNotification || "900";
    if (notifPref !== 'none') {
        var alarm = event.addComponent('VALARM');
        alarm.addProperty("ACTION", "DISPLAY");
        alarm.addProperty("TRIGGER", -1 * notifPref);
        alarm.addProperty("DESCRIPTION", i18n.t('ical:' + iCalType + ".summary", {activity: activity.toJSON ? activity.toJSON() : activity, recipient: recipientUser.toJSON()}));
    }

    // TODO: Fix timezone passing in icalevents
    // somehow the "more correct way" of passing a timezone with DTSTART and DTEND does not work correctly yet,
    // if we add these 2 lines instead of the following line, the times seem to be interpreted in the wrong timezone,
    // and our events are off by 1 or 2 hours. Possible reason: the formatting done by event.addProperty() formats
    // it as UTC. The Reason that the two following lines do not work is because the node-iCalender library simply does not
    // support this feature --> see node-icalendar/lib/types.js line 75
    //event.addProperty('DTSTART',moment(activity.start).tz('Europe/Zurich').format(), {TZID: CET_TIMEZONE_ID} );
    //event.addProperty('DTEND',moment(activity.end).tz('Europe/Zurich').format(), {TZID: CET_TIMEZONE_ID} );

    var fromDate = moment(activity.start).toDate();
    var toDate = moment(activity.end).toDate();
    fromDate.dateTimeMode = 'floating';
    toDate.dateTimeMode = 'floating';
    event.setDate(fromDate, toDate);
    log.debug("generated ical with From: " + moment(activity.start).toDate());
    log.debug("generated ical with To: " + moment(activity.end).toDate());

    if (activity.recurrence && activity.frequency && activity.frequency !== 'once') {

        if (!frequencyMap[activity.frequency]) {
            throw new Error("unknown recurrence frequency");
        }

        event.addProperty("RRULE", _getRruleSpec(activity, recipientUser.profile.defaultWorkWeek));
    }
    event.addProperty("TRANSP", "OPAQUE");
    myCal.addComponent(event);
    return myCal;
};

function _getRruleSpec(activity) {

    var weekdayMap = {
        '0': 'SU',
        '1': 'MO',
        '2': 'TU',
        '3': 'WE',
        '4': 'TH',
        '5': 'FR',
        '6': 'SA'
    };

    var rruleSpec = { FREQ: frequencyMap[activity.frequency] };
    if (rruleSpec.FREQ === 'DAILY') {
        if (!activity.recurrence.byday) {
            throw new Error('for daily activities recurrence.byday must be defined.');
        }
        rruleSpec.BYDAY = activity.recurrence.byday.join(',');

        // Outlook Fix: Outlook really does not like it when the startDate is not part of the BYDAY rule.
        // it simply cannot parse the iCal file anymore
        // so if the DTSTART Date is on a day that is not part of the working-Days we add it specifically
        // for this event.
        var dayOfWeek = weekdayMap['' + moment(activity.start).day()];
        if (!_.contains(rruleSpec.BYDAY, dayOfWeek)) {
            rruleSpec.BYDAY = rruleSpec.BYDAY + ',' + dayOfWeek;
        }
    }

    if (activity.recurrence.endby.type === 'on') {
        rruleSpec.UNTIL = activity.recurrence.endby.on;
    } else if (activity.recurrence.endby.type === 'after') {
        rruleSpec.COUNT = activity.recurrence.endby.after;
    }
    return rruleSpec;
}

function _getTimezone(activity) {

    // TOOD: use the correct timezone for this activity, currecntly using fixed CEST timezone
    var tz = new ical.VTimezone(null, CET_TIMEZONE_ID);

    var std = tz.addComponent('STANDARD');
    std.addProperty('DTSTART', new Date(1970, 0, 1, 4, 0, 0));
    std.addProperty('RRULE', {FREQ: 'YEARLY', INTERVAL: 1, BYMONTH: '10', BYDAY: '-1SU'});
    std.addProperty('TZOFFSETFROM', '0200');
    std.addProperty('TZOFFSETTO', '0100');

    var dst = tz.addComponent('DAYLIGHT');
    dst.addProperty('DTSTART', new Date(1970, 0, 1, 3, 0, 0));
    dst.addProperty('RRULE', {FREQ: 'YEARLY', INTERVAL: '1', BYDAY: '-1SU', BYMONTH: '3'});
    dst.addProperty('TZOFFSETFROM', '0100');
    dst.addProperty('TZOFFSETTO', '0200');

    return tz;
}

function getOccurrences(activity, fromDate) {

    fromDate = fromDate || moment(activity.start).subtract( 1, 'day').toDate();

    if (activity.frequency === 'once') {
        return [activity.start];
    } else {
        var rrule = new ical.RRule(_getRruleSpec(activity), moment(activity.start).toDate());
        return rrule.nextOccurences(fromDate, 100);
    }
}

module.exports = {
    getIcalObject: getIcalObject,
    getOccurrences: getOccurrences
};
