var config = require('../config/config'),
    moment = require('moment-timezone'),
    urlComposer = require('./urlcomposer'),
    _ = require('lodash'),
    fromDefault = config.email.fromString,
    emailSender = require('ypbackendlib').emailSender(config, process.cwd() + '/' + config.email.templatesDir);

var defaultLocals = function (i18n) {

    var localMoment = function(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };

    return {

        moment: localMoment,
        urlComposer: urlComposer,
        t: i18n.t,

        header: i18n.t('email:default.header'),
        notDisplayedCorrectly: i18n.t('email:default.notDisplayedCorrectly'),
        notDisplayedCorrectlyLink: i18n.t('email:default.notDisplayedCorrectlyLink'),
        imgServer: config.webclientUrl,
        logo: config.webclientUrl + '/assets/img/logo.png'
    };
};

var sendCalInvite = function (toUser, type, iCalString, event, i18n, reason) {
    // default method is request
    var method = 'REQUEST';
    // for cancellation we use CANCEL
    if (type === 'cancel') {
        method = 'CANCEL';
    }

    var mailExtensions = {
        alternatives: [
            {
                contentType: 'text/calendar; charset="utf-8"; method=' + method,
                content: iCalString,
                contentDisposition: 'inline'
            }
        ],
        encoding: 'base64'
//        attachments: [
//            {
//                filename: 'ical.ics',
//                content: iCalString,
//                contentType: 'text/calendar'
//            }
//        ],
    };

    var subject = i18n.t('email:iCalMail.' + type + '.subject', {reason: reason, event: event.toJSON()});
    var locals = {
        salutation: i18n.t('email:iCalMail.' + type + '.salutation', {user: toUser.toJSON()}),
        text: i18n.t('email:iCalMail.' + type + '.text', {event: event.toJSON(), profileLink: urlComposer.profileUrl()}),
        image: urlComposer.ideaImageUrl(event.idea.number),
        imgServer: config.webClientUrl,
        link: urlComposer.icalUrl(event.id, type, toUser.id),
        linkText: i18n.t('email:iCalMail.' + type + '.linkText')
    };
    _.defaults(locals, defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, toUser.email, subject, 'calendarEventMail', locals, mailExtensions);

};

var sendEventInvite = function sendEventInvite(email, invitingUser, event, invitedUser, invitationId, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };
    var frequency = event.frequency;
    var weekday = localMoment(event.start).format("dddd") + (frequency === 'week' ? 's' : '');
    var date = localMoment(event.start).format("D.M.") +
        frequency === 'once' ? '' :
        localMoment(event.lastEventEnd).format("D.M.YYYY");

    var time = localMoment(event.start).format('HH:mm') + ' - ' + localMoment(event.end).format('HH:mm');

    var eventDate = weekday + '<br/>' + time + '<br/>' + date;

    var subject = i18n.t("email:EventInvitation.subject", {inviting: invitingUser.toJSON(), event: event.toJSON()});
    var locals = {
        salutation: i18n.t('email:EventInvitation.salutation' + (invitedUser ? '': 'Anonymous'), {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:EventInvitation.text', {inviting: invitingUser.toJSON(), event: event.toJSON()}),
        link: urlComposer.eventInviteUrl(invitationId),
        linkText: i18n.t('email:EventInvitation.linkText'),
        title: event.idea.title,
        event: event,
        eventDate: eventDate,
        image: urlComposer.ideaImageUrl(event.idea.number)
    };
    _.defaults(locals, defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'eventInviteMail', locals);
};

var getDailyEventSummaryLocals = function getDailyEventSummaryLocals(locals, i18n) {
    var mailLocals = _.defaults({

        salutation: i18n.t('email:dailySummary.salutation', locals)


    }, defaultLocals(i18n));
    _.extend(mailLocals, locals);

    return mailLocals;
};

/**
 * sends a dailyPlannedEventsSummary Email.
 * @param toAddress - the address to send the email to
 * @param events - an array of activities, that have in their events property NOT an array events but only ONE event
 *                that is to be mentioned in the summary mail.
 * @param user - a user object with a populated profile.
 * @param i18n - an i18n object to be used to translate the email content
 */
var sendDailyEventSummary = function sendDailyEventSummary(toAddress, locals, user, i18n) {
    var subject = i18n.t("email:dailySummary.subject", locals);

    var mailLocals = getDailyEventSummaryLocals(locals, i18n);
    _.extend(mailLocals, locals);

    var mailExtensions = {};
    if(config.email.bcc && config.email.bcc.dailyEventsSummary) {
        mailExtensions.bcc = config.email.bcc.dailyEventsSummary;
    }
    emailSender.sendEmail(fromDefault, toAddress, subject, 'dailyEventsSummary', mailLocals, mailExtensions);
};

var close = function close() {
    emailSender.close();
};

module.exports = {
    closeConnection: close,
    encryptLinkToken: emailSender.encryptLinkToken,
    decryptLinkToken: emailSender.decryptLinkToken,
    sendCalInvite: sendCalInvite,
    sendEventInvite: sendEventInvite,
    sendDailyEventSummary: sendDailyEventSummary
};