var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    path = require('path'),
    crypto = require('crypto'),
    _ = require('lodash'),
    moment = require('moment'),
    templatesDir = path.join(__dirname, 'emailtemplates'),
    nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates'),
    smtpTransport = nodemailer.createTransport("SMTP", {
        service: "Mailjet",
        auth: {
            user: "785bb8e4ce318859e0c786257d39f99e",
            pass: "ba3fdc7db0242a16100625394b587085"
        }
    }),
    urlComposer = require('./urlcomposer');

var fromDefault = "YouPers Digital Health <dontreply@youpers.com>",
    linkTokenSeparator = '|';

var encryptLinkToken = function (linkToken) {

    var cipher = crypto.createCipher(config.linkTokenEncryption.algorithm, config.linkTokenEncryption.key);
    var encrypted = cipher.update(linkToken, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
};

var decryptLinkToken = function (token) {
    var decipher = crypto.createDecipher(config.linkTokenEncryption.algorithm, config.linkTokenEncryption.key);
    var decrypted = decipher.update(token, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
};

var sendEmail = function (from, to, subject, templateName, locals) {
    emailTemplates(templatesDir, function (err, template) {
        if (err) {
            log.error({err: err}, 'error during parsing of all email-templates');
        } else {

            _.extend(locals, {
                from: from,
                to: to,
                subject: subject
            });

            // Send a single email
            template(templateName, locals, function (err, html, text) {
                    if (err) {
                       log.error({err:err, locals: locals}, "error during email rendering for :" + to + " template: " + templateName);
                    } else {
                        var mail = {
                            from: from || fromDefault, // sender address
                            to: to, // list of receivers
                            subject: subject, // Subject line
                            text: text, // plaintext body
                            html: html // html body
                        };
                        smtpTransport.sendMail(mail, function (err, responseStatus) {
                            if (err) {
                                log.error({err:err}, "error while sending email for :" + to + " template: " + templateName);
                            } else {
                                log.info({responseStatus: responseStatus, message: responseStatus.message}, "email sent: " + to + " template: " + templateName);
                            }
                        });
                    }

                }
            );


        }
    });
};


var sendEmailVerification = function (user, i18n) {

    var from = fromDefault;
    var to = user.email;
    var subject = i18n.t("email:emailVerification.subject");

    var encryptedEmailAddress = encryptLinkToken(to);
    var verificationLink = urlComposer.emailVerificationUrl(encryptedEmailAddress);

    var locals = {
        salutation: i18n.t('email:emailVerification.salutation', {user: user.toJSON()}),
        text: i18n.t('email:emailVerification.text', {user: user.toJSON()}),
        footer: i18n.t('email:ActivityPlanInvitation.footer'),
        link: verificationLink
    };

    sendEmail(from, to, subject, 'genericYouPersMail', locals);

};

var sendPasswordResetMail = function (user,i18n) {
    var from = fromDefault;
    var to = user.email;
    var subject = i18n.t("email:passwordReset.subject");

    var tokenToEncrypt = user.id + linkTokenSeparator + new Date().getMilliseconds();
    var encryptedToken = encryptLinkToken(tokenToEncrypt);
    var passwordResetLink = urlComposer.passwordResetUrl(encryptedToken, user.firstname, user.lastname);

    var locals = {
        salutation: i18n.t('email:passwordReset.salutation', {user: user.toJSON()}),
        text: i18n.t('email:passwordReset.text', {user: user.toJSON()}),
        footer: i18n.t('email:passwordReset.footer'),
        link: passwordResetLink
    };

    sendEmail(from, to, subject, 'genericYouPersMail', locals);

};


var sendCalInvite = function (to, type, iCalString, i18n, reason) {
    // default method is request
    var method = 'REQUEST';
    // for cancellation we use CANCEL
    if (type === 'cancel') {
        method = 'CANCEL';
    }

    var mail = {
        from: fromDefault, // sender address
        to: to, // list of receivers
        subject: i18n.t('email:iCalMail.'+type+'.subject'), // Subject line
        text: i18n.t('email:iCalMail.'+type+'.text', {reason: reason}),
        html: i18n.t('email:iCalMail.'+type+'.html', {reason: reason}),
        alternatives: [
            {
                contentType: 'text/calendar; charset="UTF-8"; method=' + method,
                contentEncoding: '7bit',
                contents: iCalString

            }
        ],
        attachments: [
            {
                fileName: 'ical.ics',
                contents: iCalString,
                contentType: 'application/ics"'
            }
        ]};

    smtpTransport.sendMail(mail, function (err, responseStatus) {
        if (err) {
            console.log(err);
        } else {
            console.log(responseStatus.message);
        }
    });
};

var sendActivityPlanInvite = function sendActivityPlanInvite(email, invitingUser, plan, invitedUser, i18n) {

    moment.lang(i18n.language());

    var frequency = plan.mainEvent.frequency;
    var weekday = moment(plan.mainEvent.start).format("dddd") + (frequency === 'week' ? 's' : '');
    var date = moment(plan.mainEvent.start).format("D.M.") +
        frequency === 'once' ? '' :
            moment(plan.events[plan.events.length-1].end).format("D.M.YYYY");

    var time = moment(plan.mainEvent.start).format('HH:mm') + ' - ' + moment(plan.mainEvent.end).format('HH:mm');

    var eventDate = weekday + '<br/>' + time + '<br/>' + date;

    var subject = i18n.t("email:ActivityPlanInvitation.subject", {inviting: invitingUser.toJSON(), plan: plan.toJSON()});
    var locals = {
        salutation: i18n.t('email:ActivityPlanInvitation.salutation' + (invitedUser ? '': 'Anonymous'), {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:ActivityPlanInvitation.text', {inviting: invitingUser.toJSON(), plan: plan.toJSON()}),
        link: urlComposer.activityPlanInviteUrl(plan.activity._id, invitingUser._id),
        title: plan.activity.title,
        plan: plan,
        eventDate: eventDate,
        image: urlComposer.activityImageUrl(plan.activity.number),
        header: i18n.t('email:ActivityPlanInvitation.header'),
        footer: i18n.t('email:ActivityPlanInvitation.footer')
    };
    sendEmail(fromDefault, email, subject, 'activityInviteMail', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, invitedUser, i18n) {

    var subject = i18n.t("email:CampaignLeadInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});
    var token = encryptLinkToken(campaign._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: urlComposer.campaignLeadInviteUrl(campaign._id, invitingUser._id, token),
        salutation: i18n.t('email:CampaignLeadInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:CampaignLeadInvite.text', {inviting: invitingUser.toJSON(), campaign: campaign.toJSON()}),
        image: urlComposer.campaignImageUrl(), // TODO: use avatar from campaign instead of hardcoded stressmanagement image
        header: i18n.t('email:CampaignLeadInvite.header'),
        footer: i18n.t('email:CampaignLeadInvite.footer')
    };
    sendEmail(fromDefault, email, subject, 'campaignLeadInviteMail', locals);
};

var sendOrganizationAdminInvite = function sendOrganizationAdminInvite(email, invitingUser, organization, invitedUser, i18n) {

    var subject = i18n.t("email:OrganizationAdminInvite.subject", {inviting:  invitingUser.toJSON(), organization: organization.toJSON()});
    var token = encryptLinkToken(organization._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: urlComposer.orgAdminInviteUrl(organization._id, invitingUser._id, token),
        salutation: i18n.t('email:OrganizationAdminInvite.salutation' + invitedUser ? '': 'Anonymous', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:OrganizationAdminInvite.text', {inviting: invitingUser.toJSON(), organization: organization.toJSON()}),
        header: i18n.t('email:OrganizationAdminInvite.header'),
        footer: i18n.t('email:OrganizationAdminInvite.footer')
    };
    sendEmail(fromDefault, email, subject, 'genericYouPersMail', locals);
};

/**
 * sends a dailyPlannedEventsSummary Email.
 * @param toAddress - the address to send the email to
 * @param plans - an array of activityPlans, that have in their events property NOT an array events but only ONE event
 *                that is to be mentioned in the summary mail.
 * @param user - a user object with a populated profile.
 * @param i18n - an i18n object to be used to translate the email content
 */
var sendDailyEventSummary = function sendDailyEventSummary(toAddress, plans, user, i18n) {
    var subject = i18n.t("email:DailyEventSummary.subject", {events: plans});

    var locals = {
        events: plans,
        salutation: i18n.t('email:DailyEventSummary.salutation'),
        text: "to be written...",
        link: "mylink",
        footer: "myFooter"
    };

    sendEmail(fromDefault, toAddress, subject, 'dailyEventsSummary', locals);
};

var close = function close() {
    smtpTransport.close();
};

module.exports = {
    closeConnection: close,
    encryptLinkToken: encryptLinkToken,
    decryptLinkToken: decryptLinkToken,
    linkTokenSeparator: linkTokenSeparator,
    sendEmail: sendEmail,
    sendEmailVerification: sendEmailVerification,
    sendCalInvite: sendCalInvite,
    sendPasswordResetMail: sendPasswordResetMail,
    sendActivityPlanInvite: sendActivityPlanInvite,
    sendCampaignLeadInvite: sendCampaignLeadInvite,
    sendOrganizationAdminInvite: sendOrganizationAdminInvite,
    sendDailyEventSummary: sendDailyEventSummary
};