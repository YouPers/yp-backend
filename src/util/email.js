var config = require('../config/config'),
    moment = require('moment-timezone'),
    urlComposer = require('./urlcomposer'),
    _ = require('lodash'),
    fromDefault = config.email.fromString,
    linkTokenSeparator = config.linkTokenEncryption.separator,
    emailSender = require('ypbackendlib').emailSender(config, process.cwd() + '/' + config.email.templatesDir);

var defaultLocals = function (i18n) {
    return {
        header: i18n.t('email:default.header'),
        notDisplayedCorrectly: i18n.t('email:default.notDisplayedCorrectly'),
        notDisplayedCorrectlyLink: i18n.t('email:default.notDisplayedCorrectlyLink'),
        imgServer: config.webclientUrl,
        logo: config.webclientUrl + '/assets/img/logo.png'
    };
};

var sendCalInvite = function (toUser, type, iCalString, activity, i18n, reason) {
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

    var subject = i18n.t('email:iCalMail.' + type + '.subject', {reason: reason, activity: activity.toJSON()});
    var locals = {
        salutation: i18n.t('email:iCalMail.' + type + '.salutation', {user: toUser.toJSON()}),
        text: i18n.t('email:iCalMail.' + type + '.text', {activity: activity.toJSON(), profileLink: urlComposer.profileUrl()}),
        title: activity.idea.title,
        activity: activity,
        image: urlComposer.ideaImageUrl(activity.idea.number),
        footer: i18n.t('email:iCalMail.footer'),
        imgServer: config.webClientUrl,
        icalUrl: urlComposer.icalUrl(activity.id, type, toUser.id)
    };

    emailSender.sendEmail(fromDefault, toUser.email, subject, 'calendarEventMail', locals, mailExtensions);

};

var sendActivityInvite = function sendActivityInvite(email, invitingUser, activity, invitedUser, invitationId, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };
    var frequency = activity.frequency;
    var weekday = localMoment(activity.start).format("dddd") + (frequency === 'week' ? 's' : '');
    var date = localMoment(activity.start).format("D.M.") +
        frequency === 'once' ? '' :
        localMoment(activity.lastEventEnd).format("D.M.YYYY");

    var time = localMoment(activity.start).format('HH:mm') + ' - ' + localMoment(activity.end).format('HH:mm');

    var eventDate = weekday + '<br/>' + time + '<br/>' + date;

    var subject = i18n.t("email:ActivityInvitation.subject", {inviting: invitingUser.toJSON(), activity: activity.toJSON()});
    var locals = {
        salutation: i18n.t('email:ActivityInvitation.salutation' + (invitedUser ? '': 'Anonymous'), {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:ActivityInvitation.text', {inviting: invitingUser.toJSON(), activity: activity.toJSON()}),
        link: urlComposer.activityInviteUrl(invitationId),
        linkText: i18n.t('email:ActivityInvitation.linkText'),
        title: activity.idea.title,
        activity: activity,
        eventDate: eventDate,
        image: urlComposer.ideaImageUrl(activity.idea.number),
        header: i18n.t('email:ActivityInvitation.header'),
        footer: i18n.t('email:ActivityInvitation.footer'),
        logo: urlComposer.mailFooterImageUrl()
    };
    _.extend(locals, defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, invitedUser, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };
    var subject = i18n.t("email:CampaignLeadInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});
    var token = emailSender.encryptLinkToken(campaign._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));

    var duration = localMoment(campaign.start).format('D.M.YYYY') + ' - ' + localMoment(campaign.end).format('D.M.YYYY');

    var locals = {
        link: urlComposer.campaignLeadInviteUrl(campaign._id, invitingUser._id, token),
        linkText: i18n.t('email:CampaignLeadInvite.linkText'),
        welcomeHeader: i18n.t('email:CampaignLeadInvite.welcomeHeader'),
        salutation: i18n.t('email:CampaignLeadInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:CampaignLeadInvite.text', {
            inviting: invitingUser.toJSON(),
            campaign: campaign.toJSON()
        }),
        campaign: campaign,
        duration: duration,
        image: urlComposer.campaignImageUrl(campaign.topic.picture)
    };
    _.extend(locals, defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'campaignLeadInviteMail', locals);
};

var sendCampaignParticipantInvite = function sendCampaignParticipantInvite(email, subject, text, invitingUser, campaign, testOnly, i18n) {

    var locals = {
        campaign: campaign,

        salutation: i18n.t('email:CampaignParticipantInvite.salutation', { campaign: campaign.toJSON() }),
        text: text,
        image: urlComposer.campaignImageUrl(campaign.topic.picture),
        link: testOnly ? '' : urlComposer.campaignWelcomeUrl(campaign._id),
        linkText: i18n.t('email:CampaignParticipantInvite.linkText'),

        campaignLeadsHeader: i18n.t('email:CampaignParticipantInvite.campaignLeadsHeader')

    };
    _.extend(locals, defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'campaignParticipantInviteMail', locals);
};

var sendOrganizationAdminInvite = function sendOrganizationAdminInvite(email, invitingUser, organization, invitedUser, i18n) {

    var subject = i18n.t("email:OrganizationAdminInvite.subject", {inviting:  invitingUser.toJSON(), organization: organization.toJSON()});
    var token = emailSender.encryptLinkToken(organization._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        title: i18n.t("email:OrganizationAdminInvite.title"),
        link: urlComposer.orgAdminInviteUrl(organization._id, invitingUser._id, token),
        salutation: i18n.t('email:OrganizationAdminInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:OrganizationAdminInvite.text', {inviting: invitingUser.toJSON(), organization: organization.toJSON()}),
        header: i18n.t('email:OrganizationAdminInvite.header'),
        footer: i18n.t('email:OrganizationAdminInvite.footer'),
        imgServer: config.webClientUrl
    };
    emailSender.sendEmail(fromDefault, email, subject, 'genericYouPersMail', locals);
};

/**
 * sends a dailyPlannedEventsSummary Email.
 * @param toAddress - the address to send the email to
 * @param events - an array of activities, that have in their events property NOT an array events but only ONE event
 *                that is to be mentioned in the summary mail.
 * @param user - a user object with a populated profile.
 * @param i18n - an i18n object to be used to translate the email content
 */
var sendDailyEventSummary = function sendDailyEventSummary(toAddress, events, user, i18n) {
    var subject = i18n.t("email:DailyEventSummary.subject", {events: events});

    var locals = {
        events: events,
        salutation: i18n.t('email:DailyEventSummary.salutation'),
        text: "to be written...",
        link: "mylink",
        footer: "myFooter"
    };

    emailSender.sendEmail(fromDefault, toAddress, subject, 'dailyEventsSummary', locals);
};

var close = function close() {
    emailSender.close();
};

module.exports = {
    closeConnection: close,
    encryptLinkToken: emailSender.encryptLinkToken,
    decryptLinkToken: emailSender.decryptLinkToken,
    sendCalInvite: sendCalInvite,
    sendActivityInvite: sendActivityInvite,
    sendCampaignLeadInvite: sendCampaignLeadInvite,
    sendCampaignParticipantInvite: sendCampaignParticipantInvite,
    sendOrganizationAdminInvite: sendOrganizationAdminInvite,
    sendDailyEventSummary: sendDailyEventSummary
};