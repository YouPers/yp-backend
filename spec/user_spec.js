'use strict';

var frisby = require('frisby');
var email = require('../util/email');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

var testUser = {
    username: 'new_unittest_user',
    fullname: 'Testing Unittest',
    firstname: 'Testing',
    lastname: 'Unittest',
    email: 'ypunittest1+newtestuser@gmail.com',
    password: 'nopass',
    preferences: {
        workingDays: ['MO', 'TU', 'WE', 'TH']
    }
};

var validateUser = {
    username: testUser.username,
    email: testUser.email
};

frisby.create('POST validate new user')
    .post(URL + '/users/validate', validateUser)
    .expectStatus(200)
    .after(function () {
        frisby.create('POST new user')
            .post(URL + '/users', testUser)
            .expectStatus(201)
            .afterJSON(function (newUser) {

                frisby.create('POST validate new user FAIL')
                    .post(URL + '/users/validate', validateUser)
                    .expectStatus(409)
                    .toss();


                frisby.create('GET all users')
                    .get(URL + '/users')
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .expectJSONTypes('*', {
                        id: String,
                        lastname: String
                    }).afterJSON(function (userList) {
                        expect(userList[0].email).toBeUndefined();
                        expect(userList[0].username).toBeUndefined();

                        var testuserid = '';
                        userList.forEach(function (user) {
                            if (user.fullname === 'Testing Unittest') {
                                testuserid = user.id;
                            }
                        });

                        frisby.create('GET just our testuser')
                            .get(URL + '/users/' + testuserid)
                            .expectStatus(200)
                            // 'afterJSON' automatically parses response body as JSON and passes it as an argument
                            .afterJSON(function (user) {

                                // add the username becuase the backend is not returning it as a default.
                                user.username = 'new_unittest_user';
                                expect(user.id).toEqual(testuserid);
                                expect(user.preferences.workingDays).toContain('MO');
                                expect(user.preferences.workingDays).not.toContain('FR');

                                expect(user.preferences.starredActivities.length).toEqual(0);

                                frisby.create('POST verify email address SUCCESS')
                                    .post(URL + '/users/' + testuserid + '/email_verification', { token: email.encryptLinkToken('yp-test-user@gmail.com') })
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .auth('new_unittest_user', 'nopass')
                                    .toss();

                                frisby.create('POST verify email address FAIL invalid token')
                                    .post(URL + '/users/' + testuserid + '/email_verification', { token: "invalid token" })
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(409)
                                    .auth('new_unittest_user', 'nopass')
                                    .toss();
                                frisby.create('POST verify email address FAIL authorization')
                                    .post(URL + '/users/' + testuserid + '/email_verification', { token: "invalid token" })
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST request password reset without username FAIL invalid')
                                    .auth()
                                    .post(URL + '/users/request_password_reset', { balbla: "blaba" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST request password reset unknown username FAIL invalid')
                                    .auth()
                                    .post(URL + '/users/request_password_reset', { usernameOrEmail: "blaba" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST request password reset known username SUCCESS')
                                    .auth()
                                    .post(URL + '/users/request_password_reset', { usernameOrEmail: "new_unittest_user" })
                                    .expectStatus(200)
                                    .toss();

                                frisby.create('POST request password reset known email SUCCESS')
                                    .auth()
                                    .post(URL + '/users/request_password_reset', { usernameOrEmail: "ypunittest1+newtestuser@gmail.com" })
                                    .expectStatus(200)
                                    .toss();

                                frisby.create('POST password reset no token, no password FAIL')
                                    .auth()
                                    .post(URL + '/users/password_reset', { bal: "bla" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST password reset invalid token, no password FAIL')
                                    .auth()
                                    .post(URL + '/users/password_reset', { token: "IAmAnInvalidToken" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST password reset invalid token with password FAIL')
                                    .auth()
                                    .post(URL + '/users/password_reset', { token: "IAmAnInvalidToken", password: "myNewPassword" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST password reset invalid token with password FAIL')
                                    .auth()
                                    .post(URL + '/users/password_reset', { token: "IAmAnInvalidToken", password: "myNewPassword" })
                                    .expectStatus(409)
                                    .toss();

                                var expiredToken = email.encryptLinkToken(newUser.id + '|' + (new Date().getMilliseconds() - (11 * 60 * 1000)));
                                var validToken = email.encryptLinkToken(newUser.id + '|' + (new Date().getMilliseconds()));

                                frisby.create('POST password reset valid OLD token with password FAIL because of expired token')
                                    .auth()
                                    .post(URL + '/users/password_reset', { token: expiredToken, password: "myNewPassword" })
                                    .expectStatus(409)
                                    .toss();

                                frisby.create('POST password reset valid token with password SUCCESS')
                                    .auth()
                                    .post(URL + '/users/password_reset', { token: validToken, password: "myNewPassword" })
                                    .expectStatus(200)
                                    .after(function () {
                                        frisby.create('POST Login with new Password SUCCESS')
                                            .post(URL + '/login', {})
                                            .auth('new_unittest_user', 'myNewPassword')
                                            .expectStatus(200)
                                            .afterJSON(function (user) {
                                                frisby.create('POST password reset back to original value SUCCESS')
                                                    .auth()
                                                    .post(URL + '/users/password_reset', { token: validToken, password: "nopass" })
                                                    .expectStatus(200)
                                                    .after(function () {

                                                        user.preferences.starredActivities.push(consts.aloneActivity.id);

                                                        frisby.create('PUT a new starred Activity')
                                                            .put(URL + '/users/' + testuserid, user)
                                                            .auth(testUser.username, testUser.password)
                                                            .expectStatus(200)
                                                            .afterJSON(function (updatedUser) {
                                                                expect(updatedUser.preferences.starredActivities).toContain(consts.aloneActivity.id);

                                                                updatedUser.preferences.starredActivities = [];

                                                                frisby.create('remove a starred Activity and check whether it is gone')
                                                                    .put(URL + '/users/' + testuserid, updatedUser)
                                                                    .auth(testUser.username, testUser.password)
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (nextUpdatedUser) {
                                                                        expect(nextUpdatedUser.preferences.starredActivities).not.toContain(consts.aloneActivity.id);

                                                                        user.password_old = 'nopass';
                                                                        user.password = "newpass";

                                                                        frisby.create('PUT change password')
                                                                            .put(URL + '/users/' + testuserid, user)
                                                                            .auth(testUser.username, testUser.password)
                                                                            .expectStatus(200)
                                                                            .afterJSON(function (user2) {

                                                                                frisby.create('PUT change password / GET test invalid credentials')
                                                                                    .auth(user.username, "invalid password")
                                                                                    .get(URL + '/activityplans')
                                                                                    .expectStatus(401)
                                                                                    .toss();

                                                                                frisby.create('PUT change password / GET test new credentials, 204 no content for activityplans')
                                                                                    .auth(user.username, user.password)
                                                                                    .get(URL + '/activityplans')
                                                                                    .expectStatus(204)// new user, no content yet
                                                                                    .after(function () {
                                                                                        frisby.create('DELETE our testuser')
                                                                                            .auth('sysadm', 'backtothefuture')
                                                                                            .delete(URL + '/users/' + user.id)
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
    })
    .toss();

