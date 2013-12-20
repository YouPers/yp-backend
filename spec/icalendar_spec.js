var ical = require('icalendar'),
    moment = require('moment');

describe('icalendar module', function() {

    it('should generate a ical String for a simple event', function() {
        var event = new ical.VEvent('cded25be-3d7a-45e2-b8fe-8d10c1f8e5a9');

        var beforeMyBeginDate =  moment.utc("2014-10-31T17:00").toDate();
        var myBeginDate =  moment.utc("2014-11-01T17:00").toDate();
        var myEndDate =  moment.utc("2014-11-01T18:00").toDate();


        console.log('Begin: ' + myBeginDate);
        console.log('End: ' + myEndDate);
        console.log(myBeginDate.getTimezoneOffset());
        console.log(myEndDate.getTimezoneOffset());


        var rec = new ical.RRule({FREQ: 'DAILY', COUNT: 4}, myBeginDate);

        event.setSummary("Test calendar event");
        event.setDate(myBeginDate, myEndDate);
        event.addProperty('RRULE', rec);

        var myCal = new ical.iCalendar();
        myCal.addComponent(event);


        console.log(myCal.toString());


        console.log(rec.nextOccurences(beforeMyBeginDate, 100));

        expect(event.toString().length).toBeGreaterThan(11);
        console.log(event.toString());
        console.log(rec);
    });
});