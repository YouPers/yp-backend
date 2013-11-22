'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port +'/api/v1/';


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA=='
        }

    }
});

frisby.create('POST new user')
    .post(URL + 'users', {
        username: 'unittest_user',
        fullname:'Testing Unittest',
        firstname: 'Testing',
        lastname: 'Unittest',
        email: 'yp-test-user@gmail.com',
        password:'nopass' })
    .expectStatus(201)
    .toss();

frisby.create('GET all users')
    .get(URL + 'users')
    .expectStatus(200)
    .expectJSONTypes('*', {
        id: String,
        username: String,
        email: String
    }).afterJSON(function (userList) {
        var nrOfUsers = userList.length;
        var testuserid = '';
        userList.forEach(function (user) {
            if (user.username === 'unittest_user') {
                testuserid = user.id;
            }
        });

        frisby.create('GET just our testuser')
            .get(URL + 'users/'+ testuserid)
            .expectStatus(200)
            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
            .afterJSON(function(user) {
                expect(user.id).toEqual(testuserid);
                expect(user.username).toEqual( 'unittest_user');
                frisby.create('DELETE our testuser users')
                    .delete(URL+ 'users/' + user.id)
                    .expectStatus(200)
                    .toss();
            })
            .toss();

        frisby.create('DELETE our testuser')
            .delete(URL + 'users/'+ testuserid)
            .expectStatus(200)
            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
            .toss();

    })
    .toss();



