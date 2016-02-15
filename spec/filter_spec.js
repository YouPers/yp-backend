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

frisby.create('GET ideas with two ANDed options')

    .get(URL + '/ideas?filter[qualityFactor]=5&filter[number]=INS-1')
    .expectStatus(200)
    .expectJSONLength(8)
    .toss();

frisby.create('GET ideas with < option')
    .get(URL + '/ideas?filter[number]=<INS-19')
    .expectStatus(200)
    .expectJSONLength(11)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[number]=<<INS-19')
    .expectStatus(200)
    .expectJSONLength(10)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with object id filter')
    .get(URL + '/ideas?filter[id]=54ca2fc88c0832450f0e1aad')
    .expectStatus(200)
    .expectJSONLength(1)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with to << options')
    .get(URL + '/ideas?filter[id]=54ca2fc88c0832450f0e1aad,54ca2fc88c0832450f0e1aae')
    .expectStatus(200)
    .expectJSONLength(2)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with date')
    .get(URL + '/ideas?filter[created]=>1970-01-01')
    .expectStatus(200)
    .expectJSONLength(52)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with date')
    .get(URL + '/ideas?filter[created]=<1970-01-01')
    .expectStatus(200)
    .expectJSONLength(0)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with date')
    .get(URL + '/ideas?filter[created]=>1970-01-01&filter[created]=<2020-01-01')
    .expectStatus(200)
    .expectJSONLength(52)
    .afterJSON(function (ideas) {
    })
    .toss();

frisby.create('GET ideas with date')
    .get(URL + '/ideas?filter[created]=>2070-01-01&filter[created]=<2020-01-01')
    .expectStatus(200)
    .expectJSONLength(0)
    .afterJSON(function (ideas) {
    })
    .toss();


frisby.create('GET ideas with date')
    .get(URL + '/ideas?filter[created]=>1970-01-01&filter[created]=<1020-01-01')
    .expectStatus(200)
    .expectJSONLength(0)
    .afterJSON(function (ideas) {
    })
    .toss();


frisby.create('GET ideas with date ')
    .get(URL + '/ideas?filter[%2Bcreated]=>1970-01-01&filter[%2Bcreated]=<2020-01-01')
    .expectStatus(200)
    .expectJSONLength(52)
    .afterJSON(function (ideas) {
    })
    .toss();
