'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.create('GET activities with one filter options returning exactly on result')
    .get(URL + '/activities?filter[number]=Act-110')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'Act-110'
    })
    .toss();

frisby.create('GET activities with filter option returning several results')
    .get(URL + '/activities?filter[source]=youpers')
    .expectStatus(200)
    .expectJSON('*', {
        source: 'youpers'
    })
    .toss();

frisby.create('GET activities with two ANDed options')
    .get(URL + '/activities?filter[source]=youpers&filter[number]=Act-17')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'Act-17'
    })
    .toss();

frisby.create('GET activities with to > option')
    .get(URL + '/activities?filter[number]=>Act-98')
    .expectStatus(200)
    .expectJSONLength(2)
    .toss();

frisby.create('GET activities with to >> options')
    .get(URL + '/activities?filter[number]=>>Act-98')
    .expectStatus(200)
    .expectJSONLength(1)
    .toss();

