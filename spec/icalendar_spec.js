var ical = require('icalendar');

describe('icalendar module', function() {

    it('should generate a ical String for a simple event', function(){

        var event = new ical.VEvent('cded25be-3d7a-45e2-b8fe-8d10c1f8e5a9');
        event.setSummary("Test calendar event");
        event.setDate(new Date(2011,11,1,17,0,0), new Date(2011,11,1,18,0,0));
        console.log(event.toString());

        expect(event.toString().length).toBeGreaterThan(11);

    });


});