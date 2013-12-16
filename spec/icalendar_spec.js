var ical = require('icalendar');

describe('icalendar module', function() {

    it('should generate a ical String for a simple event', function() {
        var event = new ical.VEvent('cded25be-3d7a-45e2-b8fe-8d10c1f8e5a9');
        var rec = new ical.RRule({FREQ: 'DAILY', COUNT: 4},new Date(2014,10,1,17,0,0));

        event.setSummary("Test calendar event");
        event.setDate(new Date(2014,11,1,17,0,0), 60*60);
        event.addProperty('RRULE', rec);

        var myCal = new ical.iCalendar();
        myCal.addComponent(event);

        console.log(myCal.toString());


        console.log(rec.nextOccurences(new Date(2014,10,1,16,0,0), 5));

        expect(event.toString().length).toBeGreaterThan(11);
        console.log(event.toString());
        console.log(rec);
    });
});