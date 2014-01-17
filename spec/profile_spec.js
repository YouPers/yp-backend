/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var _ = require('lodash');
var consts = require('./testconsts');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c',
            Authorization: 'Basic dW5pdHRlc3Q6dGVzdA==' }
    }
});

var userProfile = {
    "gender": "female",
    "birthDate": "1984-04-10T06:12:19.600Z",
    "homeAddress": {
        "street": "Hintere Bahnhofstrasse",
        "houseNumber": "10",
        "zipCode": 8134,
        "city": "Lachen",
        "country": "Switzerland"
    },
    "workAddress": {
        "street": "Alpenstrasse",
        "houseNumber": "11",
        "zipCode": 6300,
        "city": "Zug",
        "country": "Switzerland"
    },
    "maritalStatus": "single",
    "userPreferences": {
        "defaultUserWeekForScheduling": {
            "monday": true,
            "tuesday": true,
            "wednesday": true,
            "thursday": true,
            "friday": true,
            "saturday": false,
            "sunday": false
        },
        "firstDayOfWeek": "Monday",
        "languageUI": "Italian",
        "timezone": "Central European Time"
    }
}

frisby.create('POST new user')
    .post(URL + '/users', {
        username: 'zzz_profile_unittest_user',
        fullname:'Profile Unittest',
        firstname: 'Testing',
        lastname: 'zzzProfileUnittest',
        email: 'yp-test-user7@gmail.com',
        password:'nopass'})
    .expectStatus(201)
    .afterJSON(function(newUser) {
        var owner = newUser.id;
        frisby.create('retrieve user profile by using its id')
            .get(URL + '/profiles')
            .auth('zzz_profile_unittest_user', 'nopass')
            .expectStatus(200)
            .afterJSON(function (profileArray) {
                var url = URL + '/profiles/' + profileArray[0].id;
                frisby.create('update user profile using its id')
                    .put(url, userProfile)
                    .auth('zzz_profile_unittest_user', 'nopass')
                    .expectStatus(200)
                    .expectJSONTypes({
                        id: String,
                        timestamp: String,
                        birthDate: String,
                        maritalStatus: String
                    })
                    .expectJSON(userProfile)
                    .toss();
                frisby.create('DELETE our testuser')
                    .auth('sysadm', 'backtothefuture')
                    .delete(URL+ '/users/' + owner)
                    .expectStatus(200)
                    .toss();

            })
            .toss();
    })
    .toss();

