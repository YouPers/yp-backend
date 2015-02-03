'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

var testUser = {
    username: 'new_unittest_user' + Math.floor((Math.random() * 10000) + 1),
    fullname: 'Testing Unittest',
    firstname: 'Testing',
    lastname: 'Unittest',
    email: 'ypunittest1+newtestuser' + Math.floor((Math.random() * 10000) + 1) + '@gmail.com',
    password: 'nopass'
};

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        frisby.create('UserCustom: GET friends, nobody here')
            .get(URL + '/users/friends')
            .auth(user.username, 'yp')
            .expectStatus(200)
            .expectJSONLength(0)
            .afterJSON(function (users) {
                testUser.campaign = campaign.id;
                frisby.create('UserCustom: POST new user, SUCCESS')
                    .post(URL + '/users', testUser)
                    .auth(user.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (postedUser) {
                        frisby.create('UserCustom: GET friends, one friend should be here')
                            .get(URL + '/users/friends')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .expectJSONLength(1)
                            .afterJSON(function(users) {
                                cleanupFn();
                                frisby.create('TestCleanUp: remove User')
                                    .delete(URL + '/users/' + postedUser.id)
                                    .auth('test_sysadm', 'yp')
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();
                    }).toss();
            }).toss();
    });
