var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});


frisby.create('iCal: plan once activity and check whether event is generated')
    .post(URL + '/activityplans', {
        "owner": consts.users.unittest.id,
        "activity": consts.aloneActivity.id,
        "visibility": "private",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-10-16T12:00:00.000Z",
            "end": "2014-10-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {

        frisby.create('get Ical String for this plan')
            .get(URL + '/activityplans/' + newPlan.id + '/ical.ics?email=true')
            .expectStatus(200)
            .after(function(err, res, body) {
                console.log(body);

                frisby.create('Activity Plan Slave: delete slave')
                    .delete(URL + '/activityplans/' + newPlan.id)
                    .auth('sysadm','backtothefuture')
                    .expectStatus(200)
                    .toss();

            })
            .toss();

    })
    .toss();