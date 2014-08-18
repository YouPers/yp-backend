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
    .expectJSONLength(4)
    .toss();

frisby.create('GET ideas with < option')
    .get(URL + '/ideas?filter[number]=<Act-09')
    .expectStatus(200)
    .expectJSONLength(5)
    .afterJSON(function (ideas) {
//        for (var i = 0; i < ideas.length; i++) {
//            console.log('filtered activiy (=>Act-98): ' + ideas[i].number);
//        }
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[number]=<<Act-09')
    .expectStatus(200)
    .expectJSONLength(4)
    .afterJSON(function (ideas) {
//        for (var i = 0; i < ideas.length; i++) {
//            console.log('filtered activiy (=>>Act-98): ' + ideas[i].number);
//        }
    })
    .toss();

