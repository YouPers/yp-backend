/**
 * Created by irig on 14.01.14.
 */

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
    "owner": consts.users.unittest.id,
    "gender": "female",
    "birthDate": "1984-04-10T06:12:19.600Z",
    "homeAddress": {
        "street": "Hintere Bahnhofstrasse",
        "houseNumber": "10",
        "zipCode": "8134",
        "city": "Lachen",
        "country": "Switzerland"
    },
    "workAddress": {
        "street": "Alpenstrasse",
        "houseNumber": "11",
        "zipCode": "6300",
        "city": "Zug",
        "country": "Switzerland"
    },
    "maritalStatus": "single",
    "userPreferences": {
        "defaultUserWeekForScheduling": {
            "monday": false,
            "tuesday": true,
            "wednesday": false,
            "thursday": false,
            "friday": true,
            "saturday": true,
            "sunday": false
        },
        "firstDayOfWeek": "Sunday",
        "languageUI": "Italian",
        "timezone": "Pacific Standard Time"
    }
}

frisby.create('delete first all profile of current user')
    .delete(URL + '/profiles')
    .expectStatus(200)
    .after(function() {
        frisby.create('create user profile for current user')
            .post(URL + '/profiles', userProfile)
            .expectStatus(201)
            .afterJSON(function(newProfile) {
                frisby.create('get all user profiles for current user')
                    .get(URL + '/profiles')
                    .expectStatus(200)
                    .expectJSONTypes('*', {
                        id: String,
                        timestamp: Date,
                        birthDate: Date,
                        maritalStatus: String
                    }).afterJSON(function (profileList) {
                        var nrOfProfiles = profileList.length;
                        var testProfileId = '';
                        profileList.forEach(function (profile) {
                            if (profile.birthDate === "1984-04-10T06:12:19.600Z") {
                                testProfileId = profile.id;
                            }
                        });
                    })
            })
            .toss();

    })
    .toss();
