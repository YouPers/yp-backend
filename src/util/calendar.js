var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    _ = require('lodash'),
    ical = require('icalendar'),
    moment = require('moment-timezone'),

    CET_TIMEZONE_ID = "Europe/Zurich";

var frequencyMap = {
    'day': 'DAILY',
    'week': 'WEEKLY',
    'month': 'MONTHLY'
};


var getIcalObject = function (plan, recipientUser, iCalType, i18n, reason) {

    // fix for non existing plan.text
    if (_.isUndefined(plan.text)) {
        plan.text = "";
    }

    var isGroupPlan = plan.executionType === 'group';
    var isMasterPlan = !plan.masterPlan;

    var myCal = new ical.iCalendar();
    myCal.addProperty("CALSCALE", "GREGORIAN");
    myCal.addComponent(_getTimezone(plan));

    // if this is a SlavePlan we use the masterPlans id as the iCal id, if it is a masterPlan we use its id
    var iCalEventId = isMasterPlan ? plan._id : plan.masterPlan._id || plan.masterPlan;
    var event = new ical.VEvent(iCalEventId);

    // if this is a SlavePlan we use the masterPlans __v as the iCal SEQUENCE, if it is a masterPlan we use its __v
    var sequence = isMasterPlan ? plan.__v : plan.masterPlan.__v;
    event.addProperty("SEQUENCE", sequence);

    if (isGroupPlan) {

        // Organizer and attendees are only relevant for group plans
        // the organizer of this event is either the owner of the plan or the owner of the masterPlan.
        // The owner of the masterPlan is always the first member of the JoiningUsers Collection --> activityPlan_model Line:264
        var organizer = isMasterPlan ? plan.owner : plan.joiningUsers[0];
        var targetAttendee = recipientUser;
        var otherAttendees = plan.joiningUsers.slice(1);

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

    // TODO: Fix timezone passing in icalevents
    // somehow the "more correct way" of passing a timezone with DTSTART and DTEND does not work correctly yet,
    // if we add these 2 lines instead of the following line, the times seem to be interpreted in the wrong timezone,
    // and our events are off by 1 or 2 hours. Possible reason: the formatting done by event.addProperty() formats
    // it as UTC. The Reason that the two following lines do not work is because the node-iCalender library simply does not
    // support this feature --> see node-icalendar/lib/types.js line 75
    //event.addProperty('DTSTART',moment(plan.mainEvent.start).tz('Europe/Zurich').format(), {TZID: CET_TIMEZONE_ID} );
    //event.addProperty('DTEND',moment(plan.mainEvent.end).tz('Europe/Zurich').format(), {TZID: CET_TIMEZONE_ID} );

    var fromDate = moment(plan.mainEvent.start).toDate();
    var toDate = moment(plan.mainEvent.end).toDate();
    fromDate.dateTimeMode = 'floating';
    toDate.dateTimeMode = 'floating';
    event.setDate(fromDate, toDate);
    log.debug("generated ical with From: " + moment(plan.mainEvent.start).toDate());
    log.debug("generated ical with To: " + moment(plan.mainEvent.end).toDate());

    if (plan.mainEvent.recurrence && plan.mainEvent.frequency && plan.mainEvent.frequency !== 'once') {

        if (!frequencyMap[plan.mainEvent.frequency]) {
            throw new Error("unknown recurrence frequency");
        }

        event.addProperty("RRULE", _getRruleSpec(plan, recipientUser.profile.defaultWorkWeek));
    }
    event.addProperty("TRANSP", "OPAQUE");
    myCal.addComponent(event);
    return myCal;
};

function _getRruleSpec(plan) {

    var weekdayMap = {
        '0': 'SU',
        '1': 'MO',
        '2': 'TU',
        '3': 'WE',
        '4': 'TH',
        '5': 'FR',
        '6': 'SA'
    };

    var rruleSpec = { FREQ: frequencyMap[plan.mainEvent.frequency] };
    if (rruleSpec.FREQ === 'DAILY') {
        rruleSpec.BYDAY = plan.mainEvent.recurrence.byday.join(',');

        // Outlook Fix: Outlook really does not like it when the startDate is not part of the BYDAY rule.
        // it simply cannot parse the iCal file anymore
        // so if the DTSTART Date is on a day that is not part of the working-Days we add it specifically
        // for this event.
        var dayOfWeek = weekdayMap['' + moment(plan.mainEvent.start).day()];
        if (!_.contains(rruleSpec.BYDAY, dayOfWeek)) {
            rruleSpec.BYDAY = rruleSpec.BYDAY + ',' + dayOfWeek;
        }
    }

    if (plan.mainEvent.recurrence.endby.type === 'on') {
        rruleSpec.UNTIL = plan.mainEvent.recurrence.endby.on;
    } else if (plan.mainEvent.recurrence.endby.type === 'after') {
        rruleSpec.COUNT = plan.mainEvent.recurrence.endby.after;
    }
    return rruleSpec;
}

function _getTimezone(plan) {

    // TOOD: use the correct timezone for this plan, currecntly using fixed CEST timezone
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

function getOccurrences(plan, fromDate) {

    fromDate = fromDate || moment(plan.mainEvent.start).subtract('day', 1).toDate();

    if (plan.mainEvent.frequency === 'once') {
        return [plan.mainEvent.start];
    } else {
        var rrule = new ical.RRule(_getRruleSpec(plan), moment(plan.mainEvent.start).toDate());
        return rrule.nextOccurences(fromDate, 100);
    }
}

module.exports = {
    getIcalObject: getIcalObject,
    getOccurrences: getOccurrences
};
