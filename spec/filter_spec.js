'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.create('GET ideas with one filter options returning exactly on result')
    .get(URL + '/ideas?filter[number]=Act-110')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'Act-110'
    })
    .toss();

frisby.create('GET ideas with filter option returning several results')
    .get(URL + '/ideas?filter[source]=youpers')
    .expectStatus(200)
    .expectJSON('*', {
        source: 'youpers'
    })
    .toss();

frisby.create('GET ideas with two ANDed options')
    .get(URL + '/ideas?filter[source]=youpers&filter[number]=Act-17')
    .expectStatus(200)
    .expectJSONLength(11)
    .toss();

frisby.create('GET ideas with < option')
    .get(URL + '/ideas?filter[number]=<Act-09')
    .expectStatus(200)
    .expectJSONLength(5)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[number]=<<Act-09')
    .expectStatus(200)
    .expectJSONLength(4)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[id]=5278c6adcdeab69a25000046')
    .expectStatus(200)
    .expectJSONLength(1)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[id]=5278c6adcdeab69a25000046,5278c6adcdeab69a2500006f')
    .expectStatus(200)
    .expectJSONLength(2)
    .afterJSON(function (ideas) {
    })
    .toss();
