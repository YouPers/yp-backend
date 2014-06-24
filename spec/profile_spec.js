/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
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
        "starredActivities": [{timestamp: new Date().toISOString(), activity: "5278c6adcdeab69a25000054"}],
        "rejectedActivities": [{timestamp: new Date().toISOString(), activity: "5278c6adcdeab69a25000090"}],
        "rejectedActivityPlans": []
    }
};

frisby.create('POST new user')
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
        frisby.create('retrieve user profile by authentication')
            .get(URL + '/profiles')
            .auth('XXX_profile_unittest_user', 'nopass')
            .expectStatus(200)
            .afterJSON(function (profileArray) {
                var url = URL + '/profiles/' + profileArray[0].id;
                frisby.create('update user profile using its id')
                    .put(url, userProfile)
                    .auth('xxx_profile_unittest_user', 'nopass')
                    .expectStatus(200)
                    .expectJSONTypes({
                        id: String,
                        birthDate: String,
                        maritalStatus: String
                    })
                    .expectJSON(userProfile)
                    .toss();
                frisby.create('DELETE our testuser')
                    .delete(URL+ '/users/' + owner)
                    .auth('sysadm', 'backtothefuture')
                    .expectStatus(200)
                    .toss();

            })
            .toss();
    })
    .toss();

