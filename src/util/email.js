var config = require('../config/config'),
    moment = require('moment-timezone'),
    urlComposer = require('./urlcomposer'),
    _ = require('lodash'),
    fromDefault = config.email.fromString,
    linkTokenSeparator = config.linkTokenEncryption.separator,
    emailSender = require('ypbackendlib').emailSender(config, process.cwd() + '/' + config.email.templatesDir);

function _defaultLocals (i18n) {

    var localMoment = function(date) {
        require('./moment-business').addBusinessMethods(moment);
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
        logo: config.webclientUrl + '/assets/img/avatar_coach_blue_60.png'
    };
}

function _formatActivityDateString(activity, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };
    var frequency = activity.frequency;
    var weekday = localMoment(activity.start).format("dddd") + (frequency === 'week' ? 's' : '');
    var date = localMoment(activity.start).format("D.M.") +
    frequency === 'once' ? '' :
        localMoment(activity.lastEventEnd).format("D.M.YYYY");

    var time = localMoment(activity.start).format('HH:mm') + ' - ' + localMoment(activity.end).format('HH:mm');

    return weekday + '<br/>' + time + '<br/>' + date;
}

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
        image: urlComposer.ideaImageUrl(activity.idea),
        imgServer: config.webClientUrl,
        link: urlComposer.icalUrl(activity.id, type, toUser.id),
        linkText: i18n.t('email:iCalMail.' + type + '.linkText')
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, toUser.email, subject, 'calendarEventMail', locals, mailExtensions);

};

var sendActivityInvite = function sendActivityInvite(email, invitingUser, activity, invitedUser, invitationId, i18n) {

    var subject = i18n.t("email:ActivityInvitation.subject", {inviting: invitingUser.toJSON(), activity: activity.toJSON()});
    var locals = {
        salutation: i18n.t('email:ActivityInvitation.salutation' + (invitedUser ? '': 'Anonymous'), {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:ActivityInvitation.text', {inviting: invitingUser.toJSON(), activity: activity.toJSON()}),
        link: urlComposer.activityInviteUrl(invitationId),
        linkText: i18n.t('email:ActivityInvitation.linkText'),
        title: activity.title,
        activity: activity,
        eventDate: _formatActivityDateString(activity, i18n),
        image: urlComposer.ideaImageUrl(activity.idea)
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendActivityUpdate = function sendActivityUpdate(email, activity, user, i18n) {

    var subject = i18n.t("email:ActivityUpdate.subject");
    var locals = {
        salutation: i18n.t('email:ActivityUpdate.salutation' + (user ? '': 'Anonymous'), {recipient: user ? user.toJSON() : {}}),
        text: i18n.t('email:ActivityUpdate.text', { owner: activity.owner.toJSON() }),
        link: urlComposer.activityUrl(activity.campaign, activity.idea.id, activity.id),
        linkText: i18n.t('email:ActivityUpdate.linkText'),
        title: activity.idea.title,
        activity: activity,
        eventDate: _formatActivityDateString(activity, i18n),
        image: urlComposer.ideaImageUrl(activity.idea)
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendActivityDeleted = function sendActivityDeleted(email, activity, user, i18n) {

    var subject = i18n.t("email:ActivityDeleted.subject");
    var locals = {
        salutation: i18n.t('email:ActivityDeleted.salutation' + (user ? '': 'Anonymous'), {recipient: user ? user.toJSON() : {}}),
        text: i18n.t('email:ActivityDeleted.text', { owner: activity.owner.toJSON() }),
        link: urlComposer.homeUrl(),
        linkText: i18n.t('email:ActivityDeleted.linkText'),
        title: activity.idea.title,
        activity: activity,
        eventDate: _formatActivityDateString(activity, i18n),
        image: urlComposer.ideaImageUrl(activity.idea)
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, organization, invitedUser, i18n) {

    var localMoment = function localMoment(date) {
        return moment(date).lang(i18n.lng()).tz('Europe/Zurich');
    };
    var subject = i18n.t("email:CampaignLeadInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});

    var duration = localMoment(campaign.start).format('D.M.YYYY') + ' - ' + localMoment(campaign.end).format('D.M.YYYY');

    var token = emailSender.encryptLinkToken(invitedUser.id + linkTokenSeparator + new Date().getMilliseconds());
    var link = urlComposer.campaignLeadInviteAndResetPasswordUrl(campaign._id, invitingUser._id, invitedUser._id, invitedUser.username, token);

    var locals = {
        link: link,
        linkText: i18n.t('email:CampaignLeadInvite.linkText'),
        welcomeHeader: i18n.t('email:CampaignLeadInvite.welcomeHeader'),
        salutation: i18n.t('email:CampaignLeadInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:CampaignLeadInvite.text', {
            inviting: invitingUser.toJSON(),
            campaign: campaign.toJSON(),
            organization: organization.toJSON()
        }),
        campaign: campaign,
        duration: duration,
        image: urlComposer.campaignImageUrl(campaign.topic.picture)
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'campaignLeadInviteMail', locals);
};

var sendCampaignParticipantInvite = function sendCampaignParticipantInvite(email, invitingUser, campaign, testOnly, i18n) {

    var subject = i18n.t("email:CampaignParticipantInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});


    var locals = {
        campaign: campaign,
        salutation: i18n.t('email:CampaignParticipantInvite.salutation', { campaign: campaign.toJSON() }),
        text: i18n.t('email:CampaignParticipantInvite.text', { campaign: campaign.toJSON(), link: urlComposer.campaignWelcomeUrl(campaign._id)}),
        image: urlComposer.campaignImageUrl(campaign.topic.picture),
        // ignoring testOnly here, reason: Feedback Helmut/Stefan
        //link: testOnly ? '' : urlComposer.campaignWelcomeUrl(campaign._id),
        link: urlComposer.campaignWelcomeUrl(campaign._id),
        linkText: i18n.t('email:CampaignParticipantInvite.linkText'),

        campaignLeadsHeader: i18n.t('email:CampaignParticipantInvite.campaignLeadsHeader')

    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'campaignParticipantInviteMail', locals);
};

var sendOrganizationAdminInvite = function sendOrganizationAdminInvite(email, invitingUser, organization, invitedUser, i18n) {

    var subject = i18n.t("email:OrganizationAdminInvite.subject", {inviting:  invitingUser.toJSON(), organization: organization.toJSON()});
    var token = emailSender.encryptLinkToken(organization._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: urlComposer.orgAdminInviteUrl(organization._id, invitingUser._id, token),
        linkText: i18n.t("email:OrganizationAdminInvite.linkText"),
        salutation: i18n.t('email:OrganizationAdminInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:OrganizationAdminInvite.text', {inviting: invitingUser.toJSON(), organization: organization.toJSON()})
    };
    _.defaults(locals, _defaultLocals(i18n));
    emailSender.sendEmail(fromDefault, email, subject, 'genericYouPersMail', locals);
};

var getStandardMailLocals = function getStandardMailLocals(mailType, locals, i18n) {
    var mailLocals = _.defaults({
        mailType: mailType,
        subject: i18n.t("email:" + mailType + ".subject", locals),
        translate: function (key) {
            return i18n.t("email:" + mailType + "." + key, locals)
        }
    }, _defaultLocals(i18n));
    _.extend(mailLocals, locals);
    return mailLocals;
};

/**
 * sends a standard email
 * @param mailType - the type of the mail, specifies the template and localization used to customize the mail
 * @param toAddress - the address to send the email to
 * @param locals - collection of data for populating the email
 * @param user - a user object with a populated profile.
 * @param i18n - an i18n object to be used to translate the email content
 */
var sendStandardMail = function sendDailyEventSummary(mailType, toAddress, locals, user, i18n) {

    var mailLocals = getStandardMailLocals(mailType, locals, i18n);
    _.extend(mailLocals, locals);
    var mailExtensions = {};
    if(config.email.bcc && config.email.bcc[mailType]) {
        mailExtensions.bcc = config.email.bcc[mailType];
    }
    emailSender.sendEmail(fromDefault, toAddress, locals.subject, mailType, mailLocals, mailExtensions);
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
    sendActivityUpdate: sendActivityUpdate,
    sendActivityDeleted: sendActivityDeleted,
    sendCampaignLeadInvite: sendCampaignLeadInvite,
    sendCampaignParticipantInvite: sendCampaignParticipantInvite,
    sendOrganizationAdminInvite: sendOrganizationAdminInvite,

    sendStandardMail: sendStandardMail,
    getStandardMailLocals: getStandardMailLocals,
    renderEmailTemplate: emailSender.renderEmailTemplate
};