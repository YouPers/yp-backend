var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');
var moment = require('moment');





frisby.create('Event: post event to test "invite" query param')
    .post(URL + '/events?invite=' + consts.users.test_ind2.id, {
        "owner": consts.users.test_ind1.id,
        "idea": consts.groupIdea.id,
        "visibility": "public",
        "title": "myTitle",
        "campaign": "527916a82079aa8704000006",
        "executionType": "group",
        "start": moment().add(1, 'w').day(2).add(1, 'hours').toISOString(),
        "end": moment().add(1, 'w').day(2).add(2, 'hours').toISOString(),
        "allDay": false,
        "frequency": "once",
        "status": "active"
    })
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {

        frisby.create('Event: get Invitations to see whether ind2 is invited')
            .get(URL + '/invitations')
            .auth('test_ind2', 'yp')
            .expectStatus(200)
            .afterJSON(function (invitations) {
                expect(invitations.length).toEqual(1);
                expect(invitations[0].event).toEqual(newPlan.id);

                frisby.create('Event: delete event 4')
                    .delete(URL + '/events/' + newPlan.id)
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .toss();

            })
            .toss();
    })
    .toss();