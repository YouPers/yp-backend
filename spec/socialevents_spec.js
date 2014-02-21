/**
 * Created by irig on 14.01.14.
 */

'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var _ = require('lodash');
var consts = require('./testconsts'),
    moment = require('moment');

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

frisby.create('SocialEvents: POST an activityPlan as user 1')
    .auth('test_ind1', 'yp')
    .post(URL + '/activityplans', {
        "owner": consts.users.test_ind1.id,
        "activity": consts.groupActivity.id,
        "visibility": "public",
        "title": "myTitle",
        "executionType": "group",
        "mainEvent": {
            "start": "2014-06-16T12:00:00.000Z",
            "end": "2014-06-16T13:00:00.000Z",
            "allDay": false,
            "frequency": "once"
        },
        "status": "active"
    })
    .expectStatus(201)
    .afterJSON(function (newPlan) {
        frisby.create('SocialEvents: GET SocialEventsForUser as User 2, not in the same campaign')
            .auth('test_ind2', 'yp')
            .get(URL + '/socialevents')
            .expectStatus(200)
            .afterJSON(function (events) {
                expect(_.any(events, {refDoc: newPlan.id})).toBeFalsy();
            })
            .toss();

        var newUser = {
            "avatar": "",
            "email": "ypunittest1+socialTestUser@gmail.com",
            "emailValidatedFlag": true,
            "firstname": "socialTestUser",
            "fullname": "socialTestUser",
            "password": "yp",
            "lastname": "socialTestUser",
            "roles": ["individual"],
            "tempPasswordFlag": false,
            "username": "socialtestuser",
            "version": 0,
            "campaign": "527916a82079aa8704000006"
        };

        frisby.create('SocialEvents: POST a new user in the same campaign as test_ind1')
            .post(URL + '/users', newUser)
            .expectStatus(201)
            .afterJSON(function (savedUser) {

                frisby.create('SocialEvents: GET SocialEventsForUser as SocialTestUser, in the same campaign as User 1')
                    .auth('socialtestuser', 'yp')
                    .get(URL + '/socialevents')
                    .expectStatus(200)
                    .afterJSON(function (events) {

                        expect(_.any(events, {refDoc: newPlan.id})).toBeTruthy();
                        expect(events.length).toBeGreaterThan(0);

                        frisby.create('SocialEvents: DELETE the created ActPlan')
                            .auth('test_sysadm', 'yp')
                            .delete(URL + '/activityplans/' + newPlan.id)
                            .expectStatus(200)
                            .after(function () {

                                frisby.create('SocialEvents: Create Comment on activity')
                                    .auth('test_ind1', 'yp')
                                    .post(URL + '/comments', {
                                        author: '527916a82079aa8704000006',
                                        refDoc: '5278c6adcdeab69a25000054',
                                        refDocModel: 'Activity',
                                        refDocPath: {type: String},   // subPath inside the doc, if the comment refers to a subPath inside the doc, e.g. one specific event
                                        refDocTitle: 'Führe am Feierabend zur Entspannung Meditationsübungen durch',
                                        refDocLink: 'http//:unusedtestlink',
                                        created: moment(),
                                        text: "Mein text"
                                    })
                                    .expectStatus(201)
                                    .afterJSON(function (savedComment) {


                                        frisby.create('SocialEvents: GET SocialEventsForUser as SocialTestUser, in the same campaign as User 1, expect to see comment in sociallog')
                                            .auth('socialtestuser', 'yp')
                                            .get(URL + '/socialevents')
                                            .expectStatus(200)
                                            .afterJSON(function (events) {

                                                expect(_.any(events, {refDoc: '5278c6adcdeab69a25000054'})).toBeTruthy();

                                                frisby.create('SocialEvents: GET SocialEventsForUser as SocialTestUser, in the same campaign as User 1, expect to see comment in sociallog')
                                                    .auth('test_ind2', 'yp')
                                                    .get(URL + '/socialevents')
                                                    .expectStatus(200)
                                                    .afterJSON(function (events) {

                                                        expect(_.any(events, {refDoc: '5278c6adcdeab69a25000054'})).toBeFalsy();
                                                        frisby.create('SocialEvents: DELETE the created user')
                                                            .auth('test_sysadm', 'yp')
                                                            .delete(URL + '/users/' + savedUser.id)
                                                            .expectStatus(200)
                                                            .toss();

                                                        frisby.create('SocialEvents: DELETE the created comment')
                                                            .auth('test_sysadm', 'yp')
                                                            .delete(URL + '/comments/' + savedComment.id)
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



