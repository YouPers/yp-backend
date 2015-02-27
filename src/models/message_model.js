/**
 * Module dependencies.
 */
var mongoose = require('ypbackendlib').mongoose,
    common = require('ypbackendlib').commmonModels,
    SocialInteraction = mongoose.model('SocialInteraction'),
    AbstractSocialInteractionSchema = require('./socialInteraction_schema');

var config = require('../config/config');
var push = require('ypbackendlib').push(config);
var log = require('ypbackendlib').log(config);
var async = require('async');
var _ = require('lodash');


/**
 * Message Schema
 * @type {Schema}
 */
var MessageSchema = common.newSchema({

    language: {type: String, trim: true},
    important: {type: Boolean, default: false}

}, undefined, AbstractSocialInteractionSchema);


module.exports = SocialInteraction.discriminator('Message', MessageSchema);

MessageSchema.plugin(require('mongoose-eventify'));

mongoose.model('Message').on('add', function (newMessage) {
    if (newMessage.targetSpaces[0].type === 'event') {
        // this is a message on an event, we notify everybody who is joining this event of this message
        mongoose.model('Event').findById(newMessage.targetSpaces[0].targetId).populate('joiningUsers owner', '+profile +email').exec(function (err, event) {
            if (err) {
                log.error({err: err, newMessage: newMessage}, "error while loading event for new message");
                return;
            }

            // add owner of event to potential recipients
            var pushRecipients = event.joiningUsers.concat([event.owner]);

            // remove author of message, he does not need a push
            _.remove(pushRecipients, function(user) {
                return user.id === newMessage.author.toString();
            });

            mongoose.model('Profile').populate(pushRecipients, 'profile', function(err, populatedUsers) {
                async.forEach(pushRecipients, function(user) {

                    var data = {
                        type: 'eventComment',
                        event: event.id,
                        message: 'New comment on Event: ' + event.title,
                        title: 'New Comment: ' + newMessage.title
                    };

                    push.sendPush(user, data, 'eventComment', function(err, result) {
                        if (err) {
                            log.error({err: err, user: user.email}, "Error while sending push" );
                        }
                        log.info({result: result, user: user.id, data:  data}, "sent push notification");
                    });
                });
            });

        });
    }
});
