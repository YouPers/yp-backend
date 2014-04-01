var mongoose = require('mongoose');

module.exports = {
    groupActivity: {
        id: '5278c6adcdeab69a25000046'
    },
    aloneActivity: {
        id: "5278c6aecdeab69a250000b9"
    },
    users: {
        test_ind1: {
            id: '52a97f1650fca98c29000006',
            profile: "5303721a4dba580000000016"
        },
        test_ind2: {
            id: '52a97f1650fca98c29000007',
            profile: "5303721a4dba580000000017"
        },
        test_ind3: {
            id: '52a97f1650fca98c29000055'
        },
        test_campaignlead: {
            id: '52a97f1650fca98c2900000b'
        }
    },
    assessment: {
        id: '525faf0ac558d40000000005'
    },
    newUser: function (cb) {
        var User = mongoose.model('User');
        new User({
            username: 'new_unittest_user' + Math.floor((Math.random() * 10000) + 1),
            fullname: 'Testing Unittest',
            firstname: 'Testing',
            lastname: 'Unittest',
            email: 'ypunittest1+coachTestUser' + Math.floor((Math.random() * 10000) + 1) + '@gmail.com',
            password: 'nopass',
            roles: ['individual']
        }).save(cb);
    }
};