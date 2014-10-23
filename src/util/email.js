var config = require('../config/config'),
    crypto = require('crypto'),
    moment = require('moment-timezone'),
    urlComposer = require('./urlcomposer'),
    fromDefault = config.email.fromString,
    linkTokenSeparator = config.linkTokenEncryption.separator,
    emailSender = require('ypbackendlib').emailSender(config, __dirname + '/emailtemplates');

var encryptLinkToken = function (linkToken) {

    var cipher = crypto.createCipher(config.linkTokenEncryption.algorithm, config.linkTokenEncryption.key);
    return cipher.update(linkToken, 'utf8', 'hex') + cipher.final('hex');
};

var decryptLinkToken = function (token) {
    var decipher = crypto.createDecipher(config.linkTokenEncryption.algorithm, config.linkTokenEncryption.key);
    return decipher.update(token, 'hex', 'utf8') + decipher.final('utf8');
};

var sendEmailVerification = function (user, i18n) {

    var from = fromDefault;
    var to = user.email;
    var subject = i18n.t("email:emailVerification.subject");

    var encryptedEmailAddress = encryptLinkToken(to);
    var verificationLink = urlComposer.emailVerificationUrl(encryptedEmailAddress);

    var locals = {
        title: i18n.t('email:emailVerification.title'),
        salutation: i18n.t('email:emailVerification.salutation', {user: user.toJSON()}),
        text: i18n.t('email:emailVerification.text', {user: user.toJSON()}),
        header: i18n.t('email:emailVerification.header'),
        footer: i18n.t('email:emailVerification.footer'),
        background: urlComposer.mailBackgroundImageUrl(),
        logo: urlComposer.mailLogoImageUrl(),
        link: verificationLink
    };

    emailSender.sendEmail(from, to, subject, 'genericYouPersMail', locals);

};

var sendPasswordResetMail = function (user,i18n) {
    var from = fromDefault;
    var to = user.email;
    var subject = i18n.t("email:passwordReset.subject");

    var tokenToEncrypt = user.id + linkTokenSeparator + new Date().getMilliseconds();
    var encryptedToken = encryptLinkToken(tokenToEncrypt);
    var passwordResetLink = urlComposer.passwordResetUrl(encryptedToken, user.firstname, user.lastname);

    var locals = {
        title: i18n.t('email:passwordReset.title'),
        salutation: i18n.t('email:passwordReset.salutation', {user: user.toJSON()}),
        text: i18n.t('email:passwordReset.text', {user: user.toJSON()}),
        header: i18n.t('email:passwordReset.header'),
        footer: i18n.t('email:passwordReset.footer'),
        logo: urlComposer.mailLogoImageUrl(),
        background: urlComposer.mailBackgroundImageUrl(),
        link: passwordResetLink
    };

    emailSender.sendEmail(from, to, subject, 'genericYouPersMail', locals);

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
        background: urlComposer.mailBackgroundImageUrl(),
        logo: urlComposer.mailLogoImageUrl(),
        icalUrl: urlComposer.icalUrl(activity.id, type, toUser.id)
    };

    emailSender.sendEmail(fromDefault, toUser.email, subject, 'calendarEventMail', locals, mailExtensions);

};

var sendActivityInvite = function sendActivityInvite(email, invitingUser, activity, invitedUser, invitationId, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };

    var frequency = activity.mainEvent.frequency;
    var weekday = localMoment(activity.mainEvent.start).format("dddd") + (frequency === 'week' ? 's' : '');
    var date = localMoment(activity.mainEvent.start).format("D.M.") +
        frequency === 'once' ? '' :
        localMoment(activity.lastEventEnd).format("D.M.YYYY");

    var time = localMoment(activity.mainEvent.start).format('HH:mm') + ' - ' + localMoment(activity.mainEvent.end).format('HH:mm');

    var eventDate = weekday + '<br/>' + time + '<br/>' + date;

    var subject = i18n.t("email:ActivityInvitation.subject", {inviting: invitingUser.toJSON(), activity: activity.toJSON()});
    var locals = {
        salutation: i18n.t('email:ActivityInvitation.salutation' + (invitedUser ? '': 'Anonymous'), {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:ActivityInvitation.text', {inviting: invitingUser.toJSON(), activity: activity.toJSON()}),
        link: urlComposer.activityInviteUrl(invitationId),
        title: activity.idea.title,
        activity: activity,
        eventDate: eventDate,
        image: urlComposer.ideaImageUrl(activity.idea.number),
        header: i18n.t('email:ActivityInvitation.header'),
        footer: i18n.t('email:ActivityInvitation.footer'),
        logo: urlComposer.mailFooterImageUrl()
    };
    emailSender.sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, invitedUser, i18n) {

    var subject = i18n.t("email:CampaignLeadInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});
    var token = encryptLinkToken(campaign._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: urlComposer.campaignLeadInviteUrl(campaign._id, invitingUser._id, token),
        salutation: i18n.t('email:CampaignLeadInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:CampaignLeadInvite.text', {
            inviting: invitingUser.toJSON(),
            campaign: campaign.toJSON()
        }),
        image: urlComposer.campaignImageUrl(campaign.topic.picture),
        header: i18n.t('email:CampaignLeadInvite.header'),
        footer: i18n.t('email:CampaignLeadInvite.footer'),
        logo: urlComposer.mailFooterImageUrl()
    };
    emailSender.sendEmail(fromDefault, email, subject, 'campaignLeadInviteMail', locals);
};

var sendCampaignParticipantInvite = function sendCampaignParticipantInvite(email, subject, text, invitingUser, campaign, i18n) {

    var locals = {
        link: urlComposer.campaignWelcomeUrl(campaign._id),
        salutation: i18n.t('email:CampaignLeadInvite.salutationAnonymous',  {firstname: ''}),
        text: text,
        image: urlComposer.campaignImageUrl(campaign.topic.picture),
        header: i18n.t('email:CampaignLeadInvite.header'),
        footer: i18n.t('email:CampaignLeadInvite.footer'),
        logo: urlComposer.mailFooterImageUrl()
    };
    emailSender.sendEmail(fromDefault, email, subject, 'campaignLeadInviteMail', locals);
};

var sendOrganizationAdminInvite = function sendOrganizationAdminInvite(email, invitingUser, organization, invitedUser, i18n) {

    var subject = i18n.t("email:OrganizationAdminInvite.subject", {inviting:  invitingUser.toJSON(), organization: organization.toJSON()});
    var token = encryptLinkToken(organization._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        title: i18n.t("email:OrganizationAdminInvite.title"),
        link: urlComposer.orgAdminInviteUrl(organization._id, invitingUser._id, token),
        salutation: i18n.t('email:OrganizationAdminInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:OrganizationAdminInvite.text', {inviting: invitingUser.toJSON(), organization: organization.toJSON()}),
        header: i18n.t('email:OrganizationAdminInvite.header'),
        footer: i18n.t('email:OrganizationAdminInvite.footer'),
        background: urlComposer.mailBackgroundImageUrl(),
        logo: urlComposer.mailFooterImageUrl()
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
    encryptLinkToken: encryptLinkToken,
    decryptLinkToken: decryptLinkToken,
    sendEmailVerification: sendEmailVerification,
    sendCalInvite: sendCalInvite,
    sendPasswordResetMail: sendPasswordResetMail,
    sendActivityInvite: sendActivityInvite,
    sendCampaignLeadInvite: sendCampaignLeadInvite,
    sendCampaignParticipantInvite: sendCampaignParticipantInvite,
    sendOrganizationAdminInvite: sendOrganizationAdminInvite,
    sendDailyEventSummary: sendDailyEventSummary
};