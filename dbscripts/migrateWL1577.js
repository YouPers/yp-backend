var ypbackendlib = require('ypbackendlib');
var config = require('../src/config/config');
var modelNames = require('../src/models').modelNames;
var _ = require('lodash');

var schemaNames = ['user']; // schema names to be extended
var modelPath = __dirname + '/../src/models'; // path the schema extensions are located
var schemaExtensions = {};
_.forEach(schemaNames, function (name) {
    schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
});
ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);


var mongoose = require('ypbackendlib').mongoose,
    _ = require('lodash'),
    User = mongoose.model('User'),
    Campaign = mongoose.model('Campaign'),
    Profile = mongoose.model('Profile'),
    actMgr = require("../src/core/ActivityManagement");



Campaign
    .find({})
    .populate('organization')
    .exec(function (err, campaigns) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log("found campaigns: " + campaigns.length);

    _.forEach(campaigns, function (campaign) {
        console.log("processing campaign: " + campaign.organization.name + "/" + campaign.participants);
        // load the first campaignlead

        User.findById(campaign.campaignLeads[0]).select(User.privatePropertiesSelector).exec(function (err, lead) {
            if (err || !lead) {
                console.log("error: " + err);
                process.exit(1);
            }
            console.log(lead.fullname + ": processing campaignLead");

            lead.campaign = campaign._id;
            lead.save(function(err, saved) {
                if (err) {
                    console.log("error on Save: " + err);
                    console.log(err);
                    process.exit(1);
                }
                console.log(lead.fullname + ": saved user with campaignAttr");
            });

            Profile.findById(lead.profile).exec(function (err, profile) {
                if (err || !profile) {
                    console.log("error: " + err);
                    process.exit(1);
                }

                profile.campaign = campaign._id;
                profile.language = 'de';

                profile.save(function (err, profile) {
                    if (err || !profile) {
                        console.log(err);
                        process.exit(1);
                    }
                    console.log(lead.fullname + ": saved profile with campaignAttr and lang");
                });
            });
        });
    });
});


