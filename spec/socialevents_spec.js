/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var _ = require('lodash');
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

frisby.create('SocialEvents: POST an activityPlan as user 1')
    .auth('test_ind1', 'yp')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind1.id,
        "activity": consts.groupActivity.id,
        "visibility": "public",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-06-16T12:00:00.000Z",
            "end": "2014-06-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        frisby.create('SocialEvents: GET SocialEventsForUser as User 2')
            .auth('test_ind2', 'yp')
            .get(URL + '/socialevents')
            .expectStatus(200)
            .afterJSON(function(events) {
                expect(events.length).toBeGreaterThan(1);
            })
            .toss();
    })
    .toss();



