var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var Invitation = mongoose.model('Invitation');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
var Logger = require('bunyan');
var log = new Logger(config.loggerOptions);


function SocialInteraction() {
    EventEmitter.call(this);
}

util.inherits(SocialInteraction, EventEmitter);


var socialInteraction = new SocialInteraction();

socialInteraction.on('invitation:activityPlan', function (from, to, activityPlan) {

    var invitation = new Invitation({

        author: from._id,

        targetSpaces: [{
            type: 'user',
            targetId: to._id,
            targetModel: 'User'
        }],

        refDocs: [{ docId: activityPlan._id, model: 'ActivityPlan'}],

        publishTo: activityPlan.lastEventEnd
    });

    invitation.save(function(err, inv) {
        if(err) {
            socialInteraction.emit('error', err);
        }
    });

});

socialInteraction.on('invitation:campaignLead', function (from, to, campaign) {

    var invitation = new Invitation({

        author: from._id,

        targetSpaces: [{
            type: 'user',
            targetId: to._id,
            targetModel: 'User'
        }],

        refDocs: [{ docId: campaign._id, model: 'Campaign'}],

        publishTo: campaign.end
    });

    invitation.save(function(err, inv) {
        if(err) {
            socialInteraction.emit('error', err);
        }
    });

});


socialInteraction.on('error', function(err) {
    log.error(err);
    throw new Error(err);
});


module.exports = socialInteraction;
