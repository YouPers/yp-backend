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
    .expectJSONLength(4)
    .toss();

frisby.create('GET activities with < option')
    .get(URL + '/activities?filter[number]=<Act-09')
    .expectStatus(200)
    .expectJSONLength(7)
    .afterJSON(function (activities) {
        for (i = 0; i < activities.length; i++) {
            console.log('filtered activiy (=>Act-98): ' + activities[i].number);
        }
    })
    .toss();

frisby.create('GET activities with to << options')
    .get(URL + '/activities?filter[number]=<<Act-09')
    .expectStatus(200)
    .expectJSONLength(6)
    .afterJSON(function (activities) {
        for (i = 0; i < activities.length; i++) {
            console.log('filtered activiy (=>>Act-98): ' + activities[i].number);
        }
    })
    .toss();

