'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA=='
        },
        json:true
    }
});

frisby.create('POST new user')
    .post(URL + '/users', {
        username: 'new_unittest_user',
        fullname:'Testing Unittest',
        firstname: 'Testing',
        lastname: 'Unittest',
        email: 'yp-test-user@gmail.com',
        password:'nopass',
        preferences: {
            workingDays: ['MO', 'TU', 'WE', 'TH']
        }})
    .expectStatus(201)
    .afterJSON(function(newUser) {
        frisby.create('GET all users')
            .get(URL + '/users')
            .expectStatus(200)
            .expectJSONTypes('*', {
                id: String,
                username: String,
                email: String
            }).afterJSON(function (userList) {
                var nrOfUsers = userList.length;
                var testuserid = '';
                userList.forEach(function (user) {
                    if (user.username === 'new_unittest_user') {
                        testuserid = user.id;
                    }
                });

                frisby.create('GET just our testuser')
                    .get(URL + '/users/'+ testuserid)
                    .expectStatus(200)
                    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
                    .afterJSON(function(user) {
                        expect(user.id).toEqual(testuserid);
                        expect(user.username).toEqual( 'new_unittest_user');
                        expect(user.preferences.workingDays).toContain('MO');
                        expect(user.preferences.workingDays).not.toContain('FR');

                        expect(user.preferences.starredActivities.length).toEqual(0);

                        user.preferences.starredActivities.push(consts.aloneActivity.id);

                        frisby.create('PUT a new starred Activity')
                            .put(URL+ '/users/' + testuserid, user)
                            .expectStatus(200)
                            .afterJSON(function(updatedUser) {
                                expect(updatedUser.preferences.starredActivities).toContain(consts.aloneActivity.id);

                                updatedUser.preferences.starredActivities = [];

                                frisby.create('remove a starred Activity and check whether it is gone')
                                    .put(URL+ '/users/' + testuserid, updatedUser)
                                    .expectStatus(200)
                                    .afterJSON(function(nextUpdatedUser) {
                                        expect(nextUpdatedUser.preferences.starredActivities).not.toContain(consts.aloneActivity.id);


                                        frisby.create('DELETE our testuser')
                                            .delete(URL+ '/users/' + user.id)
                                            .expectStatus(200)
                                            .toss();

                                    })
                                    .toss();

                            })
                            .toss();



                    })
                    .toss();
            })
            .toss();
    })
    .toss();