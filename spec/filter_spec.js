'use strict';

var frisby = require('frisby');
require('../app.js');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port +'/api/v1/';


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA=='
        }

    }
});


frisby.create('GET acitivities with one filter options returning exactly on result')
    .get(URL + 'activities?filter[number]=Act-120')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'Act-120'
    })
    .toss();

frisby.create('GET acitivities with filter option returning several results')
    .get(URL + 'activities?filter[source]=youpers')
    .expectStatus(200)
    .expectJSON('*', {
        source: 'youpers'
    })
    .toss();

frisby.create('GET acitivities with two ANDed options')
    .get(URL + 'activities?filter[source]=youpers&filter[number]=Act-17')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'Act-17'
    })
    .toss();

frisby.create('GET acitivities with to > option')
    .get(URL + 'activities?filter[number]=>Act-98')
    .expectStatus(200)
    .expectJSONLength(2)
    .toss();

frisby.create('GET acitivities with to >> options')
    .get(URL + 'activities?filter[number]=>>Act-98')
    .expectStatus(200)
    .expectJSONLength(1)
    .toss();

