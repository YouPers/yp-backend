var config = require('../config/config'),
    mongoose = require('ypbackendlib').mongoose,
    moment = require('moment'),
    request = require('request-json'),
    log = require('ypbackendlib').log(config),
    SocialInteraction = require('../core/SocialInteraction');

var predioClient = request.createClient(config.predio.URL, {
    qs: {
        accessKey: config.predio.accessKey
    }
});



mongoose.model('User').on('add', function (user) {

    var data = {
        event: "$set",
        entityType: "user",
        entityId: user.id,
        eventTime: moment().toISOString()
    };
    log.debug({user: user.id, data: data}, "adding user to predictionIO");

    predioClient.post('events.json', data, function (err, result, body) {
        if (err || (result.statusCode >= 400)) {
            log.error({err: err, result: result, body: body}, "Error posting new user to predio");
        } else {
            log.debug({result: result, body: body}, "Saved new user to predIo");
        }
    });
});


SocialInteraction.on('socialInteraction:dismissed', function (user, socialInteraction, socialInteractionDismissed) {
    if (socialInteractionDismissed.reason === 'eventScheduled') {
        // user scheduled this idea himself, so he seems to really like it
    } else if (socialInteractionDismissed.reason === 'eventJoined') {
        // user joined an invitation to this idea, so he seems to  like it

    } else if (socialInteractionDismissed.reason === 'maxReached') {
        // SocialInteraction was dismissed because event is full - this does not say anything about like/dislike

    } else if (socialInteractionDismissed.reason === 'manuallyDismissed') {
        // user manually dismissed the socialinteraction, so he did not like it -> low score.

    } else if (socialInteractionDismissed.reason) {
        // we have an unknown reason:
        log.info({reason: socialInteractionDismissed.reason}, 'unknown dismissal reason encountered');
    } else {
        log.info({reason: socialInteractionDismissed.toObject()}, 'emtpy dismissal reason encountered');
    }

    var data = {
        event: "$set",
        entityType: "user",
        entityId: user.id,
        eventTime: moment().toISOString()
    };
    log.info({user: user.id, idea: socialInteraction.idea, reason: socialInteractionDismissed.reason, data: data}, "adding a rating event to predio");


    // TODO: add a rating event to predio
});



