var caltools = require('calendar-tools');

describe('calendar-tools Seed', function () {
    var myBirthDays = {
        "start": "2013-10-23T12:00:00.000Z",
        "end": "2013-10-23T13:00:00.000Z",
        "allDay": false,
        "frequency": "week",
        "recurrence": {
            "endby": {
                "type": "after",
                "after": 6
            },
            "every": 1,
            "exceptions": []
        }
    }


    it('should generate recurring events for simple weekly event', function () {

        var today = new Date();


        // creates a new seed Object passing event object and options
        var seed = caltools.seed(myBirthDays, {
            start: new Date(2010, 1, 1), end: new Date(2020, 1, 1)
        });

        // generates ans retrieves all instances by period
        var instances = seed.getInstances();

        expect(instances.length).toEqual(6);
    });

    it('should return a iCal-String for a recurring event', function () {
        var icalString = caltools.rfc2445.genRecurrenceString(myBirthDays);
        expect(icalString).toBeDefined();
        expect(icalString).toMatch(/DTSTART/);
        expect(icalString).toMatch(/DTEND/);
        expect(icalString).toMatch(/WEEKLY/);
    })
});