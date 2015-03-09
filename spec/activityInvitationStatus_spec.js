var frisby = require('frisby'),
    port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    _ = require('lodash'),
    consts = require('./testconsts'),
    moment = require('moment');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

// invite user to an activity plan, invitation is dismissed by joining the plan



frisby.create('Invitation: plan an activity first')
    .post(URL + '/activities', {
        "owner": consts.users.test_ind1.id,
        "idea": consts.groupIdea.id,
        "title": "myTitle",
        "visibility": "public",
        "campaign": consts.users.test_ind1.campaign,
        "executionType": "group",
        "start": moment().add(1, 'days').toDate(),
        "end": moment().add(1, 'days').add(2, 'hours').toDate(),
        "allDay": false,
        "frequency": "once",
        "status": "active"
    }, {json: true})
    .auth('test_ind1', 'yp')
    .expectStatus(201)
    .afterJSON(function (newPlan) {

        frisby.create("Invitation: invite user by email to this activity")
            .post(URL + '/activities/' + newPlan.id + "/inviteEmail", {email: "anyemail@mal.com"})
            .auth('test_ind1', 'yp')
            .expectStatus(200)
            .after(function () {

                frisby.create("Invitation: check invitation status, expect pending")
                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                    .auth('test_ind1', 'yp')
                    .expectStatus(200)
                    .afterJSON(function (result) {
                        expect(result.length).toEqual(1);
                        expect(result[0].status).toEqual('pending');

                        frisby.create("Invitation: invite user directly to this activity")
                            .post(URL + '/invitations', {
                                idea: newPlan.idea,
                                activity: newPlan.id,
                                targetSpaces: [{type: 'user', targetId: consts.users.test_ind2.id}]
                            })
                            .auth('test_ind1', 'yp')
                            .expectStatus(201)
                            .afterJSON(function (invitation) {
                                frisby.create("Invitation: check invitation status, expect pending")
                                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                                    .auth('test_ind1', 'yp')
                                    .expectStatus(200)
                                    .afterJSON(function (result) {
                                        expect(result.length).toEqual(2);
                                        expect(result[0].status).toEqual('pending');
                                        expect(result[1].status).toEqual('pending');

                                        frisby.create("Invitation: join it")
                                            .post(URL + '/activities/' + newPlan.id + "/join")
                                            .auth('test_ind2', 'yp')
                                            .expectStatus(201)
                                            .afterJSON(function (result) {
                                                frisby.create("Invitation: check invitation status, expect pending")
                                                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                                                    .auth('test_ind1', 'yp')
                                                    .expectStatus(200)
                                                    .afterJSON(function (result) {


                                                        expect(result.length).toEqual(2);
                                                        expect(_.map(result, 'status')).toContain('pending');
                                                        expect(_.map(result, 'status')).toContain('activityJoined');
                                                        frisby.create("Invitation: post public invitations for this activity")
                                                            .post(URL + '/invitations', {
                                                                idea: newPlan.idea,
                                                                activity: newPlan.id,
                                                                targetSpaces: [{
                                                                    type: 'campaign',
                                                                    targetId: consts.users.test_ind1.campaign
                                                                }]
                                                            })
                                                            .auth('test_ind1', 'yp')
                                                            .expectStatus(201)
                                                            .afterJSON(function (publicInv) {
                                                                frisby.create("Invitation: check invitation status, no difference because public invitations are not shown on status")
                                                                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                                                                    .auth('test_ind1', 'yp')
                                                                    .expectStatus(200)
                                                                    .afterJSON(function (result) {
                                                                        expect(result.length).toEqual(2);
                                                                        expect(_.map(result, 'status')).toContain('pending');
                                                                        expect(_.map(result, 'status')).toContain('activityJoined');

                                                                        frisby.create("Invitation: invite reto user directly to this activity")
                                                                            .post(URL + '/invitations', {
                                                                                idea: newPlan.idea,
                                                                                activity: newPlan.id,
                                                                                targetSpaces: [{
                                                                                    type: 'user',
                                                                                    targetId: consts.users.reto.id
                                                                                }]
                                                                            })
                                                                            .auth('test_ind1', 'yp')
                                                                            .expectStatus(201)
                                                                            .afterJSON(function (invitation2) {

                                                                                frisby.create("Invitation: check invitation status, no difference because public invitations are not shown on status")
                                                                                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                                                                                    .auth('test_ind1', 'yp')
                                                                                    .expectStatus(200)
                                                                                    .afterJSON(function (result) {
                                                                                        expect(result.length).toEqual(3);
                                                                                        expect(_.map(result, 'status')).toContain('pending');
                                                                                        expect(_.map(result, 'status')).toContain('activityJoined');
                                                                                        frisby.create("Invitation: join it")
                                                                                            .post(URL + '/activities/' + newPlan.id + "/join")
                                                                                            .auth('reto', 'reto')
                                                                                            .expectStatus(201)
                                                                                            .afterJSON(function (result) {
                                                                                                frisby.create("Invitation: check invitation status, expect 1 pending")
                                                                                                    .get(URL + '/activities/' + newPlan.id + "/invitationStatus")
                                                                                                    .auth('test_ind1', 'yp')
                                                                                                    .expectStatus(200)
                                                                                                    .afterJSON(function (result) {
                                                                                                        expect(_(result).filter(function(av) {return av.user && av.user.id === consts.users.reto.id;}).value().length).toEqual(1);
                                                                                                        expect(_(result).filter(function(av) {return av.user && av.user.id === consts.users.reto.id;}).map('status').value()).toContain('activityJoined');
                                                                                                        expect(result.length).toEqual(3);
                                                                                                        expect(_.map(result, 'status')).toContain('pending');
                                                                                                        expect(_.map(result, 'status')).toContain('activityJoined');

                                                                                                    }).toss();
                                                                                            }).toss();
                                                                                    }).toss();
                                                                            }).toss();
                                                                    }).toss();
                                                            }).toss();
                                                    }).toss();
                                            }).toss();
                                    }).toss();
                            }).toss();
                    }).toss();
            }).toss();
    }).toss();


