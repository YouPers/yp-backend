var frisby = require('frisby');
var port = process.env.PORT || 8000;
var BASE_URL = 'http://localhost:' + port;
var URL = BASE_URL + '/events';
var _ = require('lodash');
var consts = require('./testconsts');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

var initialLocation = "initialLocation";
var editedLocation = "editedLocation";
var initialDateStart = moment().add(1, 'd').hour(10).toDate();
var initialDateEnd = moment(initialDateStart).add(1, 'h').toDate();
var intialFrequency = "once";

var event = {
    "owner": consts.users.test_ind1.id,
    "idea": consts.groupIdea.id,
    "location": initialLocation,
    "visibility": "private",
    "executionType": "self",
    "title": "myTitle",
    "start": initialDateStart,
    "end": initialDateEnd,
    "allDay": false,
    "frequency": intialFrequency,
    "recurrence": {
        "endby": {
            "type": "after",
            "after": 6
        },
        "every": 1,
        "exceptions": []
    },
    "status": "active"
};


frisby.create('EventEdits: create a single event with a single event')
    .post(URL, event)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (eventPostAnswer) {

        expect(eventPostAnswer.editStatus).toEqual('editable');
        expect(eventPostAnswer.location).toEqual(initialLocation);
        expect(eventPostAnswer.executionType).toEqual("self");

        eventPostAnswer.location = editedLocation;

        frisby.create('EventEdits: update event with modified location and visibily, id: ' + eventPostAnswer.id)
            .put(URL + '/' + eventPostAnswer.id, eventPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (eventPutAnswer) {
                expect(eventPutAnswer.editStatus).toEqual('editable');
                expect(eventPutAnswer.location).toEqual(editedLocation);

                // now modify it to have more than one event
                eventPutAnswer.frequency = "week";

                frisby.create('EventEdits: update event change frequency to "week", id: ' + eventPutAnswer.id)
                    .put(URL + '/' + eventPutAnswer.id, eventPutAnswer)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (eventPutAnswer2) {
                        expect(eventPutAnswer2.editStatus).toEqual('editable');
                        expect(eventPutAnswer2.deleteStatus).toEqual('deletable');

                        frisby.create('AcitvityPlanEdits: get Events and check them')
                            .get(BASE_URL + '/occurences?filter[event]='+eventPutAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .expectJSONLength(6)
                            .after(function () {

                                // delete event
                                frisby.create('Event Edits: delete event')
                                    .delete(URL + '/' + eventPutAnswer2.id)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .toss();

                            })
                            .toss();

                    })
                    .toss();
            })
            .toss();
    })
    .toss();

var eventSingleEventPassed = _.clone(event, true);
eventSingleEventPassed.start = moment(initialDateStart).subtract(3, 'd').toDate();
eventSingleEventPassed.end = moment(initialDateEnd).subtract(3, 'd').toDate();

frisby.create('Event Edits: create single event with single event in the past')
    .post(URL, eventSingleEventPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (eventPostAnswer) {

        expect(eventPostAnswer.editStatus).toEqual('notEditablePastEvent');

        // now try to modify something even though it is not allowed to update this actvity
        eventPostAnswer.frequency = "week";

        frisby.create('EventEdits: try to update single event with single event in the past')
            .put(URL + '/' + eventPostAnswer.id, eventPostAnswer)
            .auth('test_ind1', 'yp')
            .expectStatus(409)
            .afterJSON(function (eventPutAnswer) {

                // cleanup uneditable and undeletable event
                frisby.create('EventEdits: cleanup event, id: ' + eventPostAnswer.id)
                    .delete(URL + '/' + eventPostAnswer.id)
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();


frisby.create('EventEdits: create a single event with a single event to be used as a joinable event')
    .post(URL, event)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (eventPostAnswer) {
        expect(eventPostAnswer.editStatus).toEqual('editable');

        frisby.create('EventEdits: post a join')
            .post(URL + '/'+eventPostAnswer.id +'/join')
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.owner).not.toEqual(consts.users.test_ind2.id);

                // now try to modify something even though it is not allowed to update this joined event
                slavePlanPostAnswer.frequency = "week";

                frisby.create('EventEdits: try to update event as a joiner, 403')
                    .put(URL + '/' + slavePlanPostAnswer.id, slavePlanPostAnswer)
                    .auth('test_ind2', 'yp')
                    .expectStatus(403)
                    .afterJSON(function (eventPutAnswer) {

                        // now try to modify something even though it is not allowed to update this master event

                        frisby.create('EventEdits: reload masterEvent')
                            .get(URL + '/' + eventPostAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .afterJSON(function (masterEventReloaded) {
                                expect(masterEventReloaded.editStatus).toEqual('editable');

                                masterEventReloaded.frequency = "week";

                                frisby.create('EventEdits: try to update master event, id: ' + masterEventReloaded.id)
                                    .put(URL + '/' + masterEventReloaded.id, masterEventReloaded)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (eventPutAnswer) {

                                        frisby.create('EventEdits: reload slavePlan, check whether it was updated automaticallly')
                                            .get(URL + '/' + slavePlanPostAnswer.id)
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(200)
                                            .afterJSON(function (reloadedSlavePlan) {

                                                expect(reloadedSlavePlan.frequency).toEqual('week');


                                                // cleanup joined event
                                                frisby.create('EventEdits: cleanup master event, id: ' + masterEventReloaded.id)
                                                    .delete(URL + '/' + masterEventReloaded.id)
                                                    .auth('sysadm', 'backtothefuture')
                                                    .expectStatus(200)
                                                    .toss();

                                            })
                                            .toss();

                                    })
                                    .toss();

                            })
                            .toss();

                    })
                    .toss();

            })
            .toss();

    })
    .toss();

var planWeeklyThreeEventsPassed = _.clone(event, true);
var initialTime = moment().subtract(3, 'w').add(3, 'h').toDate();
planWeeklyThreeEventsPassed.start = initialTime;
planWeeklyThreeEventsPassed.end = moment(initialTime).add(1, 'h').toDate();
planWeeklyThreeEventsPassed.frequency = 'week';

frisby.create('EventEdits: create a weekly event with 3 events passed')
    .post(URL, planWeeklyThreeEventsPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (initialEvent) {
        expect(initialEvent.editStatus).toEqual('editable');

        frisby.create('EventEdits: getOccurences for this event')
            .get(BASE_URL + '/occurences?filter[event]=' + initialEvent.id + '&sort=start')
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .afterJSON(function (events) {
                var mySecondEvent = events[1];
                mySecondEvent.status = 'missed';

                frisby.create('EventEdits: mark second event as missed')
                    .put(BASE_URL + '/occurences/' + mySecondEvent.id, mySecondEvent)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (savedSecondEvent) {
                        expect(savedSecondEvent.status).toEqual('missed');


                        var postponedTime = moment(initialTime).add(1, 'h').toDate();
                        initialEvent.start = postponedTime;
                        initialEvent.end = moment(postponedTime).add(1, 'h').toDate();

                        // delete the Version information, otherwise mongo complains because we have modified the document with the call before...
                        delete initialEvent.__v;

                        frisby.create('Event Edits: update event, expect only future events to have changed, old events to be preserved')
                            .put(URL + '/' + initialEvent.id, initialEvent)
                            .auth('test_ind1', 'yp')
                            .afterJSON(function (updatedEvent) {
                                expect(updatedEvent.editStatus).toEqual('editable');

                                frisby.create('EventEdits: getOccurences for this event, check old events are preserved, new are updated')
                                    .get(BASE_URL + '/occurences?filter[event]=' + initialEvent.id + '&sort=start')
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (newEvents) {


                                        expect(events.length).toEqual(6);
                                        expect(moment(newEvents[0].start).toDate()).toEqual(initialTime);
                                        expect(moment(newEvents[2].start).toDate()).toEqual(moment(events[2].start).toDate());
                                        expect(moment(newEvents[3].start).toDate()).toEqual(moment(events[3].start).add(1, 'h').toDate());
                                        expect(moment(newEvents[5].start).toDate()).toEqual(moment(events[5].start).add(1, 'h').toDate());
                                        expect(newEvents[1].status).toEqual('missed');

                                        // cleanup joined event
                                        frisby.create('Event Edits: cleanup updatedPlan, id: ' + updatedEvent.id)
                                            .delete(URL + '/' + updatedEvent.id)
                                            .auth('sysadm', 'backtothefuture')
                                            .expectStatus(200)
                                            .toss();

                                    })
                                    .toss();
                            })
                            .toss();
                    })
                    .toss();

            })
            .toss();
    })
    .toss();


var activityNow = _.clone(activity);
activityNow.start = moment().subtract(1, 'hour').toString();
activityNow.end = moment().add(1, 'hour').toString();

frisby.create('ActivityEdits: Right Now, create a single activity with a single event happening')
    .post(URL, activityNow)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (activityPostAnswer) {
        expect(activityPostAnswer.editStatus).toEqual('editable');

        frisby.create('AcitvityPlanEdits: Right Now,get Events and check them')
            .get(BASE_URL + '/activityevents?filter[activity]=' + activityPostAnswer.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .expectJSONLength(1)
            .afterJSON(function (events) {
                expect(moment(events[0].start).toString()).toEqual(activityNow.start);

                activityPostAnswer.start = moment().subtract(3, 'hours').toString();
                activityPostAnswer.end = moment().subtract(2, 'hours').toString();

                frisby.create('ActivityEdits: Right Now, update activity with modified past time')
                    .put(URL + '/' + activityPostAnswer.id, activityPostAnswer)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (activityPutAnswer) {
                        expect(moment(activityPutAnswer.start).toString()).toEqual(activityPostAnswer.start);

                        frisby.create('AcitvityPlanEdits: Right Now, get Events after Edit and check them')
                            .get(BASE_URL + '/activityevents?filter[activity]=' + activityPostAnswer.id)
                            .auth('test_ind1', 'yp')
                            .expectStatus(200)
                            .expectJSONLength(1)
                            .afterJSON(function (events) {
                                expect(events[0].start).toEqual(activityPutAnswer.start);
                                // cleanup joined activity
                                frisby.create('Activity Edits: cleanup updatedPlan, id: ' + activityPostAnswer.id)
                                    .delete(URL + '/' + activityPostAnswer.id)
                                    .auth('sysadm', 'backtothefuture')
                                    .expectStatus(200)
                                    .toss();


                            })
                            .toss();
                    })
                    .toss();


            })
            .toss();

    })
    .toss();
