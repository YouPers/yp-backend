/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var _ = require('lodash');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});


frisby.create('GET SocialEventsForUser')
    .get(URL + '/socialevents')
    .expectStatus(200)
    .afterJSON(function(events) {
        expect(events.length).toBeGreaterThan(1);
    })
    .toss();

