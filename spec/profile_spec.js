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

var userProfile1ID = "";

var userProfile1 = {
    "owner": consts.users.unittest.id,
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

var userProfile2 = {
    "owner": consts.users.unittest.id,
    "gender": "female",
    "birthDate": "1984-04-10T06:12:19.600Z",
    "homeAddress": {
        "street": "Wilshire Blvd.",
        "houseNumber": "9601",
        "zipCode": 90210,
        "city": "Beverly Hills",
        "country": "USA"
    },
    "workAddress": {
        "street": "Hollywood Blvd.",
        "houseNumber": "7060",
        "zipCode": 90028,
        "city": "Los Angeles",
        "country": "USA"
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
        "languageUI": "English",
        "timezone": "Pacific Standard Time"
    }
}

frisby.create('delete first all profile of current user')
    .delete(URL + '/profiles')
    .expectStatus(200)
    .toss();

frisby.create('create user profile for current user')
    .post(URL + '/profiles', userProfile1)
    .expectStatus(201)
    .expectJSONTypes({
        id: String,
        timestamp: String,
        birthDate: String,
        maritalStatus: String
    })
    .expectJSON(userProfile1)
    .afterJSON(function () {

        frisby.create('check number of profiles to be 1')
            .get(URL + '/profiles')
            .expectStatus(200)
            .afterJSON(function (profileList) {
                console.log(profileList.length);
                expect(profileList.length).toBe(1);

                frisby.create('update user profile for current user, by posting a new version')
                    .post(URL + '/profiles', userProfile2)
                    .expectStatus(201)
                    .expectJSONTypes({
                        id: String,
                        timestamp: String,
                        birthDate: String,
                        maritalStatus: String
                    })
                    .expectJSON(userProfile2)
                    .afterJSON(function (profileList) {
                        frisby.create('check number of profiles to be 2')
                            .get(URL + '/profiles')
                            .expectStatus(200)
                            .afterJSON(function (profileList) {
                                console.log(profileList.length);
                                expect(profileList.length).toBe(2);


                                frisby.create('check number of profiles to be 2')
                                    .get(URL + '/profiles')
                                    .expectStatus(200)
                                    .afterJSON(function (profileList) {
                                        console.log(profileList.length);
                                        console.log(profileList[0].id);
                                        userProfile1ID = profileList[0].id;
                                        console.log(userProfile1ID);
                                        expect(profileList.length).toBe(2);


                                        frisby.create('retrieve actual profile of current user')
                                            .get(URL + '/profilesactual')
                                            .expectStatus(200)
                                            .expectJSONTypes({
                                                id: String,
                                                timestamp: String,
                                                birthDate: String,
                                                maritalStatus: String
                                            })
                                            .expectJSON(userProfile2)

                                            .afterJSON(function (profileList) {
                                                console.log(userProfile1ID);
                                                var xy = URL + '/profiles' + '/' + userProfile1ID;
                                                console.log(xy);

                                                frisby.create('retrieve first user profile, i.e. old version by using its id')
                                                    .get(URL + '/profiles' + '/' + userProfile1ID)
                                                    .expectStatus(200)
                                                    .expectJSONTypes({
                                                        id: String,
                                                        timestamp: String,
                                                        birthDate: String,
                                                        maritalStatus: String
                                                    })
                                                    .expectJSON(userProfile1)
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









