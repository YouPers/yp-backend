'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.create('GET ideas with one filter options returning exactly on result')
    .get(URL + '/ideas?filter[number]=INS-11')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        number: 'INS-11'
    })
    .toss();

frisby.create('GET ideas with filter option returning several results')
    .get(URL + '/ideas?filter[source]=youpers')
    .expectStatus(200)
    .expectJSON('*', {
        source: 'youpers'
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[id]=54860a9fb6953fc567e3e126')
    .expectStatus(200)
    .expectJSONLength(1)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[id]=54860a9fb6953fc567e3e126,54860a9fb6953fc567e3e127')
    .expectStatus(200)
    .expectJSONLength(2)
    .afterJSON(function (ideas) {
    })
    .toss();
