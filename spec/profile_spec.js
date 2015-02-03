/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
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
    "language": "it",
    "prefs": {
        "defaultWorkWeek": ['MO', 'TU', 'WE', 'TH', 'FR'],
        "firstDayOfWeek": "Monday",
        "timezone": "+01:00",
        "starredIdeas": [{timestamp: new Date().toISOString(), idea: "5278c6adcdeab69a25000054"}],
        "rejectedIdeas": [{timestamp: new Date().toISOString(), idea: "5278c6adcdeab69a25000090"}],
        "rejectedActivities": []
    }
};

frisby.create('Profile: POST new user')
    .post(URL + '/users', {
        username: 'XXX_profile_unittest_user',
        fullname:'Profile Unittest',
        firstname: 'Testing',
        lastname: 'XXXProfileUnittest',
        email: 'ypunittest1+XXXprofileuser@gmail.com',
        password:'nopass'})
    .expectStatus(201)
    .afterJSON(function(newUser) {
        var owner = newUser.id;
        frisby.create('Profile: retrieve user profile by authentication')
            .get(URL + '/profiles')
            .auth('XXX_profile_unittest_user', 'nopass')
            .expectStatus(200)
            .afterJSON(function (profileArray) {
                var profileUrl = URL + '/profiles/' + profileArray[0].id;
                frisby.create('Profile: update user profile using its id')
                    .put(profileUrl, userProfile)
                    .auth('xxx_profile_unittest_user', 'nopass')
                    .expectStatus(200)
                    .expectJSONTypes({
                        id: String,
                        birthDate: String,
                        maritalStatus: String
                    })
                    .afterJSON(function(updatedProfile) {
                        frisby.create('Profile: DELETE our testuser')
                            .delete(URL+ '/users/' + owner)
                            .auth('sysadm', 'backtothefuture')
                            .expectStatus(200)
                            .toss();
                    })
                    .toss();

            })
            .toss();
    })
    .toss();

