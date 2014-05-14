var mongoose = require('mongoose'),
    db = require('./util/database'),
    _ = require('lodash');

db.initialize(false);

mongoose.model('AssessmentResult')
    .find({campaign: null})
    .populate('owner', '+campaign')
    .exec(function (err, results) {

        _.forEach(results, function (result) {
            if (result.owner.campaign && !result.campaign) {
                console.log("updating: " + result.owner.fullname + "; setting AssResult.campaign to: " + result.owner.campaign);
                result.campaign = result.owner.campaign;
                result.save();
            }
        });
    });

mongoose.model('Profile')
    .find({campaign: null})
    .populate('owner', '+campaign')
    .exec(function (err, profiles) {

        _.forEach(profiles, function (profile) {
            if (profile.owner.campaign && !profile.campaign) {
                console.log("updating: " + profile.owner.fullname + "; setting profile.campaign to: " + profile.owner.campaign);
                profile.campaign = profile.owner.campaign;
                profile.save();
            }
        });
    });
