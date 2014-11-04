/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 28.01.14
 * Time: 14:15
 * To change this template use File | Settings | File Templates.
 */

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var BASE_URL = 'http://localhost:' + port;
var URL = BASE_URL + '/events';
var consts = require('./testconsts');
var _ = require('lodash');
var moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

// set the startDate in the future and ensure that it is a Wednesday
var startDate = moment().add(5, 'd').day(4).toDate();
var endDate = moment(startDate).add(1, 'h').toDate();

var masterPlan = {
    "owner": consts.users.test_ind1.id,
    "idea": consts.groupIdea.id,
    "visibility": "public",
    "executionType": "group",
    "title": "myTitle",
        "start": startDate,
        "end": endDate,
        "allDay": false,
        "frequency": "week",
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

frisby.create('Event Deletions: create a master event for an event deletion test')
    .post(URL, masterPlan)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {

        var masterPlanId = masterPlanPostAnswer.id;

        expect(masterPlanPostAnswer.deleteStatus).toEqual('deletable');

        frisby.create('Event Deletions: post a join')
            .post(URL + '/' + masterPlanPostAnswer.id + '/join')
            .auth('test_ind2', 'yp')
            .expectStatus(201)
            .afterJSON(function (slavePlanPostAnswer) {
                expect(slavePlanPostAnswer.deleteStatus).toEqual('deletable');

                frisby.create('Event Deletions: reload masterPlan')
                    .get(URL + '/' + masterPlanId)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {
                        expect(masterPlanReloaded.deleteStatus).toEqual('deletable');
                        expect(masterPlanReloaded.joiningUsers).toContain(consts.users.test_ind2.id);

                        frisby.create('Event Deletions: try delete slave, SUCCESS')
                            .delete(URL + '/' + slavePlanPostAnswer.id)
                            .auth('test_ind2', 'yp')
                            .expectStatus(200)
                            .after(function () {

                                frisby.create('Event Deletions: reload masterEvent, check empty JoiningUsers')
                                    .get(URL + '/' + masterPlanId)
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (masterPlanReloaded2) {
                                        expect(masterPlanReloaded2.deleteStatus).toEqual('deletable');
                                        expect(masterPlanReloaded2.joiningUsers).not.toContain(consts.users.test_ind2.id);

                                        frisby.create('Event Deletions: post a join again')
                                            .post(URL + '/' + masterPlanReloaded2.id + '/join')
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (slavePlanPostAnswer2) {
                                                expect(slavePlanPostAnswer2.deleteStatus).toEqual('deletable');

                                                frisby.create('Event Deletions: try delete master with an existing joining, SUCCESS')
                                                    .delete(URL + '/' + masterPlanReloaded.id + '?reason=I am sick')
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .after(function () {

                                                        frisby.create('Event Deletions: check all organizer events gone, SUCCESS')
                                                            .get(BASE_URL + '/occurences?filter[event]=' + masterPlanReloaded.id)
                                                            .auth('test_ind1', 'yp')
                                                            .expectStatus(200)
                                                            .expectJSONLength(0)
                                                            .after(function () {
                                                                frisby.create('Event Deletions: check all joiner events gone, SUCCESS')
                                                                    .get(BASE_URL + '/occurences?filter[event]=' + masterPlanReloaded.id)
                                                                    .auth('test_ind2', 'yp')
                                                                    .expectStatus(200)
                                                                    .expectJSONLength(0)
                                                                    .after(function () {
                                                                        frisby.create('Event Deletions: check whether master gone')
                                                                            .get(URL + '/' + masterPlanReloaded.id)
                                                                            .auth('test_ind1', 'yp')
                                                                            .expectStatus(200)
                                                                            .afterJSON(function (event) {
                                                                                expect(event.status).toEqual('deleted');
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
                            })
                            .toss();

                    }).toss();

            })
            .toss();

    })

    .toss();

var pastDateStart = new Date();
pastDateStart.setDate(pastDateStart.getDate() - 1);
var pastDateEnd = new Date();
pastDateEnd.setDate(pastDateEnd.getDate() - 1);
pastDateEnd.setHours(pastDateEnd.getHours() + 1);
var planOneEventPassed = _.cloneDeep(masterPlan);
planOneEventPassed.start = pastDateStart;
planOneEventPassed.end = pastDateEnd;
planOneEventPassed.frequency = "week";

frisby.create('Event Deletions: create event with one event in the past')
    .post(URL, planOneEventPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {

                expect(masterPlanPostAnswer.deleteStatus).toEqual('deletableOnlyFutureEvents');

                // delete by removing future events
                frisby.create('Event Deletions: delete future events')
                    .delete(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

                frisby.create('Event Deletions: reload masterEvent')
                    .get(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (masterPlanReloaded) {

                        // clean up database by removing the plan
                        frisby.create('Event Deletions: remove event')
                            .delete(URL + '/' + masterPlanPostAnswer.id)
                            .auth('sysadm', 'backtothefuture')
                            .expectStatus(200)
                            .toss();

                    }).toss();
    })
    .toss();


var earlierPastDateStart = new Date();
earlierPastDateStart.setDate(earlierPastDateStart.getDate() - 30);
var earlierDateEnd = new Date();
earlierDateEnd.setDate(earlierDateEnd.getDate() - 30);
earlierDateEnd.setHours(earlierDateEnd.getHours() + 1);
var planAllEventsPassed = _.cloneDeep(masterPlan);

planAllEventsPassed.start = earlierPastDateStart;
planAllEventsPassed.end = earlierDateEnd;
planAllEventsPassed.frequency = "day";

frisby.create('Event Deletions: create event with all events in the past')
    .post(URL, planAllEventsPassed)
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (masterPlanPostAnswer) {

        expect(masterPlanPostAnswer.deleteStatus).toEqual('notDeletableNoFutureEvents');

        // try deleting undeletable event
        frisby.create('Event Deletions: try delete Event with No Future Events, SUCCESS (but actually nothing is done) ')
            .delete(URL + '/' + masterPlanPostAnswer.id)
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .after(function() {

                // now really delete it with admin priv
                frisby.create('Event Deletions: try delete Event with No Future Events ')
                    .delete(URL + '/' + masterPlanPostAnswer.id)
                    .auth('test_sysadm', 'yp')
                    .expectStatus(200)
                    .toss();

            })
            .toss();

    }).toss();