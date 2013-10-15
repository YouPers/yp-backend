'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 3000;
var URL = 'http://localhost:'+ port +'/api/v1/';
var URL_AUTH = 'http://username:password@localhost:'+port+'/';

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c' }
    }
});

frisby.create('POST new user')
    .post(URL + 'user', {username: 'ivan', name:'Ivan Rigamonti', email: 'ivan@rigamonti.me', password:'nopass' })
    .expectStatus(201)
    .toss();




frisby.create('GET all users')
    .get(URL + 'user')
    .expectStatus(200)
    .expectJSONLength(1)
    .expectJSON('*', {
        _id: String,
        username: String,
        email: String
    })
    .expectJSON('*', {
        username: 'ivan',
        email: String
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(user) {
        // You can use any normal jasmine-style assertions here
        expect(1+1).toEqual(2);

        // Use data from previous result in next test
        //frisby.create('Update user')
        //    .put(URL_AUTH + '/users/' + user.id + '.json', {tags: ['jasmine', 'bdd']})
        //    .expectStatus(200)
        //    .toss();
    })
    .toss();

frisby.create('DELETE all users')
    .delete(URL+ 'user')
    .expectStatus(200)
    .toss();
