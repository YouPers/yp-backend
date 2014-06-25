var EventEmitter = require('events').EventEmitter;
var util = require('util');
var mongoose = require('mongoose');
var SocialInteractionModel = mongoose.model('SocialInteraction');
var SocialInteractionDismissedModel = mongoose.model('SocialInteractionDismissed');
var Invitation = mongoose.model('Invitation');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
var Logger = require('bunyan');
var log = new Logger(config.loggerOptions);
var _ = require('lodash');


function SocialInteraction() {
    EventEmitter.call(this);
}

util.inherits(SocialInteraction, EventEmitter);


var SocialInteraction = new SocialInteraction();

SocialInteraction.on('invitation:activityPlan', function (from, to, activityPlan) {

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
            SocialInteraction.emit('error', err);
        }
    });

});

SocialInteraction.on('invitation:campaignLead', function (from, to, campaign) {

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
            SocialInteraction.emit('error', err);
        }
    });

});

SocialInteraction.on('invitation:organizationAdmin', function (from, to, organization) {

    var invitation = new Invitation({

        author: from._id,

        targetSpaces: [{
            type: 'user',
            targetId: to._id,
            targetModel: 'User'
        }],

        refDocs: [{ docId: organization._id, model: 'Organization'}]
    });

    invitation.save(function(err, inv) {
        if(err) {
            SocialInteraction.emit('error', err);
        }
    });

});


SocialInteraction.on('error', function(err) {
    log.error(err);
    throw new Error(err);
});

SocialInteraction.dismissInvitation = function dismissInvitation(refDoc, users, cb) {

    var userIds;

    if(typeof users === 'object') {
        userIds = [users];
    } else {
        userIds = _.map(users, '_id');
    }


    // find all invitations for this refDoc targeted to one of these users
    Invitation.find({

        targetSpaces: {
            $elemMatch: {
                type: 'user',
                targetId: { $in: userIds },
                targetModel: 'User'
            }
        },
        refDocs: { $elemMatch: {
            docId: refDoc._id,
            model: refDoc.modelName
        }}
    }).exec(function(err, invitations) {
        _.forEach(invitations, function (invitation) {

            var spaces = _.find(invitation.targetSpaces, function(space) {
                return _.contains(userIds, space.targetId);
            });

            var users = _.map(spaces, 'targetId');

            // TODO: async all parallel -> callback
//
            _.forEach(users, function(user) {
//                SocialInteraction.dismissSocialInteraction(invitation._id, user._id || user, cb);
            });

        });
    });

};

SocialInteraction.dismissSocialInteraction = function dismissSocialInteraction(socialInteractionId, user, cb) {


    SocialInteractionModel.findById(socialInteractionId, function(err, socialInteraction) {

        if(err) {
            cb(err);
        }

        var userId = (user._id ? user._id : user);

        // just delete the socialInteraction if the only targeted space is the user
        // -> if there are no other target spaces than for this user
        if(!_.any(socialInteraction.targetSpaces, function(space) {
            return space.targetModel !== 'User' || !space.targetId.equals(userId);
        })) {
            return socialInteraction.remove(cb);
        }

        var socialInteractionDismissed = new SocialInteractionDismissedModel({
            expiresAt: socialInteraction.publishTo,
            user: userId,
            socialInteraction: socialInteraction.id
        });

        return socialInteractionDismissed.save(function(err) {
            // we deliberately want to ignore DuplicateKey Errors, because there is not reason to store the dissmissals more than once
            // MONGO Duplicate KeyError code: 11000
            if (err && err.code !== 11000) {
                return cb(err);
            }
            return cb();
        });

    });

};

module.exports = SocialInteraction;
