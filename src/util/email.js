var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    path = require('path'),
    crypto = require('crypto'),
    _ = require('lodash'),
    templatesDir = path.join(__dirname, 'emailtemplates'),
    nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates'),
    smtpTransport = nodemailer.createTransport("SMTP", {
        service: "Mailjet",
        auth: {
            user: "785bb8e4ce318859e0c786257d39f99e",
            pass: "ba3fdc7db0242a16100625394b587085"
        }
    });

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
            console.log(err);
        } else {

            _.extend(locals, {
                from: from,
                to: to,
                subject: subject
            });

            // Send a single email
            template(templateName, locals, function (err, html, text) {
                    if (err) {
                        console.log(err);
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
                                console.log(err);
                            } else {
                                console.log(responseStatus.message);
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
    var verificationLink = config.webclientUrl + "/#/email_verification/" + encryptedEmailAddress;

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
    var passwordResetLink = config.webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + user.firstname + "&lastname=" + user.lastname;

    var locals = {
        salutation: i18n.t('email:passwordReset.salutation', {user: user.toJSON()}),
        text: i18n.t('email:passwordReset.text', {user: user.toJSON()}),
        footer: i18n.t('email:passwordReset.footer'),
        link: passwordResetLink
    };

    sendEmail(from, to, subject, 'genericYouPersMail', locals);

};


var sendCalInvite = function (to, type, iCalString, i18n) {
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
        text: i18n.t('email:iCalMail.'+type+'.text'),
        html: i18n.t('email:iCalMail.'+type+'.html'),
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

    var from = fromDefault;
    var to = email;
    var subject = i18n.t("email:ActivityPlanInvitation.subject", {inviting: invitingUser.toJSON(), plan: plan.toJSON()});
    var locals = {
        salutation: i18n.t('email:ActivityPlanInvitation.salutation', {invited: invitedUser ? invitedUser.toJSON() : {}}),
        text: i18n.t('email:ActivityPlanInvitation.text', {inviting: invitingUser.toJSON(), plan: plan.toJSON()}),
        link: config.webclientUrl + "/#/activities/" + plan.activity._id + '/invitation?invitingUserId='+invitingUser._id,
        footer: i18n.t('email:ActivityPlanInvitation.footer')
    };
    sendEmail(from, to, subject, 'genericYouPersMail', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, invitedUser, i18n) {

    var from = fromDefault;
    var to = email;
    var subject = i18n.t("email:CampaignLeadInvite.subject", {inviting:  invitingUser.toJSON(), campaign: campaign.toJSON()});

    var token = encryptLinkToken(campaign._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: config.webclientUrl + "/#/campaigns/" + campaign._id + '/becomeCampaignLead?invitingUserId='+invitingUser._id+'&token='+token,
        salutation: i18n.t('email:CampaignLeadInvite.salutation', {invited: invitedUser ? invitedUser.toJSON() : {firstname: ''}}),
        text: i18n.t('email:CampaignLeadInvite.text', {inviting: invitingUser.toJSON(), campaign: campaign.toJSON()}),
        footer: i18n.t('email:CampaignLeadInvite.footer')
    };
    sendEmail(from, to, subject, 'genericYouPersMail', locals);
};


module.exports = {
    encryptLinkToken: encryptLinkToken,
    decryptLinkToken: decryptLinkToken,
    linkTokenSeparator: linkTokenSeparator,
    sendEmail: sendEmail,
    sendEmailVerification: sendEmailVerification,
    sendCalInvite: sendCalInvite,
    sendPasswordResetMail: sendPasswordResetMail,
    sendActivityPlanInvite: sendActivityPlanInvite,
    sendCampaignLeadInvite: sendCampaignLeadInvite
};