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


var sendEmailVerification = function (user) {

    var from = fromDefault;
    var to = user.email;
    var subject = "YouPers: Please verify your email address";

    var encryptedEmailAddress = encryptLinkToken(to);
    var verificationLink = config.webclientUrl + "/#/email_verification/" + encryptedEmailAddress;

    var locals = {
        user: user,
        verificationLink: verificationLink
    };

    sendEmail(from, to, subject, 'emailVerification', locals);

};

var sendPasswordResetMail = function (user) {
    var from = fromDefault;
    var to = user.email;
    var subject = "YouPers: reset password";

    var tokenToEncrypt = user.id + linkTokenSeparator + new Date().getMilliseconds();
    var encryptedToken = encryptLinkToken(tokenToEncrypt);
    var passwordResetLink = config.webclientUrl + "/#/password_reset/" + encryptedToken + "?firstname=" + user.firstname + "&lastname=" + user.lastname;

    var locals = {
        user: user,
        passwordResetLink: passwordResetLink
    };

    sendEmail(from, to, subject, 'passwordReset', locals);

};


var sendCalInvite = function (to, subject, iCalString) {
    var mail = {
        from: fromDefault, // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: "calendar invite from YouPers",
        html: "<h1>Calendar invite from YouPers</h1>",
        alternatives: [
            {
                contentType: 'text/calendar; charset="UTF-8"; method=REQUEST',
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

var sendActivityPlanInvite = function sendActivityPlanInvite(email, invitingUser, plan, invitedUser) {

    var from = fromDefault;
    var to = email;
    var subject = "Einladung von " + invitingUser.fullname;
    var locals = {
        link: config.webclientUrl + "/#/activities/" + plan.activity._id + '/invitation?invitingUserId='+invitingUser._id,
        invitingUser: invitingUser,
        plan: plan,
        invitedUser: invitedUser || {}
    };
    sendEmail(from, to, subject, 'ActivityPlanInvitation', locals);
};

var sendCampaignLeadInvite = function sendCampaignLeadInvite(email, invitingUser, campaign, invitedUser) {

    var from = fromDefault;
    var to = email;
    var subject = "Einladung von " + invitingUser.fullname + ": YouPers Kampagnenleiter";

    var token = encryptLinkToken(campaign._id +linkTokenSeparator + email +  (invitedUser ? linkTokenSeparator + invitedUser._id : ''));
    var locals = {
        link: config.webclientUrl + "/#/campaigns/" + campaign._id + '/becomeCampaignLead?invitingUserId='+invitingUser._id+'&token='+token,
        invitingUser: invitingUser,
        campaign: campaign,
        invitedUser: invitedUser || {}
    };
    sendEmail(from, to, subject, 'CampaignLeadInvitation', locals);
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