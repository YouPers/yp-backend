var mongoose = require('ypbackendlib').mongoose;
var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var moment = require('moment');

var self = module.exports  =  {
    groupIdea: {
        id: '54ca2fc88c0832450f0e1aa2'
    },
    groupIdea2: {
        id: '54ca2fc88c0832450f0e1aa3'
    },
    aloneIdea: {
        id: '54ca2fc88c0832450f0e1abb'
    },
    users: {
        test_ind1: {
            id: '52a97f1650fca98c29000006',
            username: 'test_ind1',
            profile: "5303721a4dba580000000016",
            campaign: "527916a82079aa8704000006"
        },
        yphealthcoach: {
            id: '53348c27996c80a534319bda',
            username: 'yphealthcoach'
        },
        test_ind2: {
            id: '52a97f1650fca98c29000007',
            username: 'test_ind2',
            profile: "5303721a4dba580000000017"
        },
        test_ind3: {
            id: '54f9fdc256a0e289af61bbab',
            username: 'test_ind3'
        },
        test_orgadm: {
            id: '54f9fded56a0e289af61bbad',
            username: 'test_orgadm'
        },
        test_prodadm: {
            id: '54f9fe2f56a0e289af61bbaf',
            username: 'test_prodadm'
        }
    },
    assessment: {
        id: '525faf0ac558d40000000005'
    },
    topic: {
        id: '53b416cfa43aac62a2debda1'
    },
    organization: {
        id: '52f0c64e53d523235b07d8d8'
    },
    newUser: function (cb) {
        var User = mongoose.model('User');
        var rnd = Math.floor((Math.random() * 10000) + 1);
        new User({
            username: 'new_unittest_user' + rnd,
            fullname: 'Testing Unittest',
            firstname: 'Testing',
            lastname: 'Unittest',
            email: 'ypunittest1+TestUser' + rnd + '@gmail.com',
            password: 'nopass',
            roles: ['individual']
        }).save(function(err, user) {
            if (err) {
                return cb(err);
            }
            User.findById(user.id).populate('profile').select('+email +profile').exec(function(err, user) {
                // add the email back in, because it is not part of the default selected properties of user.

                user.email = 'ypunittest1+TestUser' + rnd + '@gmail.com';

                return cb(null, user, function cleanup() {

                    frisby.create('TestCleanUp: remove User')
                        .delete(URL + '/users/' + user.id)
                        .auth('test_sysadm', 'yp')
                        .expectStatus(200)
                        .toss();
                });
            });
        });
    },
    newUserInNewCampaignApi: function(cb) {
        var campaignStart = moment({hour: 8, minute: 0, second: 0}).add(10, 'days');
        var campaignEnd = moment({hour: 17, minute: 0, second: 0}).add(6, 'weeks').add(10, 'days');

        var testCampaign = {
            "title": "testOrganization's campaign x for testing: " + Math.floor((Math.random() * 10000) + 1),
            "start": campaignStart.toDate(),
            "end": campaignEnd.toDate(),
            "topic": "53b416cfa43aac62a2debda1",
            "location": "Alpenstrasse",
            "slogan": "It's never too late!",
            "paymentStatus": "open",
            "productType": "CampaignProductType1",
            "campaignLeads": [self.users.test_orgadm.id]
        };


        frisby.create('TestSetup: POST new campaign to existing organization')
            .post(URL + '/campaigns', testCampaign)
            .auth('test_orgadm', 'yp')
            .expectStatus(201)
            .afterJSON(function (myTestCampaign) {
                var rnd = Math.floor((Math.random() * 10000) + 1);

                frisby.create('TestSetup: POST new user')
                    .post(URL + '/users', {
                        username: 'new_unittest_user' + rnd,
                        fullname: 'Testing Unittest',
                        campaign: myTestCampaign.id,
                        firstname: 'Testing',
                        lastname: 'Unittest',
                        email: 'ypunittest1+coachTestUser' + rnd + '@gmail.com',
                        password: 'yp',
                        roles: ['individual']
                    })
                    .expectStatus(201)
                    .afterJSON(function (testUser) {
                        return cb(null, testUser, myTestCampaign, function cleanup() {

                            frisby.create('TestCleanUp:')
                                .delete(URL + '/campaigns/'+ myTestCampaign.id)
                                .auth('test_sysadm', 'yp')
                                .expectStatus(200)
                                .toss();

                            frisby.create('TestCleanUp: remove User')
                                .delete(URL + '/users/' + testUser.id)
                                .auth('test_sysadm', 'yp')
                                .expectStatus(200)
                                .toss();

                        });
                    })
                    .toss();
            }).toss();
    }
};