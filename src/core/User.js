var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    SocialInteraction = require('./SocialInteraction'),
    log = require('../util/log').logger,
    _ = require('lodash');


function User() {
    EventEmitter.call(this);
}

util.inherits(User, EventEmitter);


var User = new User();

SocialInteraction.on('socialInteraction:dismissed', function (user, socialInteraction, socialInteractionDismissed) {

    // check if a recommendation for an idea is dismissed, add an rejectedIdea to the user profile
    if(socialInteraction.__t === 'Recommendation' && socialInteractionDismissed.reason === 'denied') {
        var refDocIdea = _.find(socialInteraction.refDocs, { model: 'Idea'});
        var profile = user.profile;
        profile.prefs.rejectedIdeas.push({
            timestamp: new Date(),
            idea: refDocIdea.docId
        });
        profile.save(function (err) {
            handleError(err);
        });
    }
});


function handleError(err) {
    if(err) {
        return User.emit('error', err);
    }
}

User.on('error', function (err) {
    log.error(err);
    throw new Error(err);
});
