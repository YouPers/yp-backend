var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    path = require('path'),
    crypto = require('crypto'),
    _ = require('lodash'),
    templatesDir   = path.join(__dirname, 'emailtemplates'),
    nodemailer = require('nodemailer'),
    emailTemplates = require('email-templates'),
    smtpTransport = nodemailer.createTransport("SMTP", {
        service: "Mailjet",
        auth: {
            user: "785bb8e4ce318859e0c786257d39f99e",
            pass: "ba3fdc7db0242a16100625394b587085"
        }
    });

var fromDefault = "YouPers Digital Health <dontreply@youpers.com>";

var encryptEmail = function(email) {

    var cipher = crypto.createCipher(config.emailVerification.algorithm, config.emailVerification.key);
    var encrypted = cipher.update(email, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
}

var getVerificationLink = function(user) {

};

var sendEmailVerification = function (user) {

    var from = fromDefault;
    var to = user.email;
    var subject = "YouPers: Please verify your email address";

    var encryptedEmail = encryptEmail(to);
    var verificationLink = config.webclientUrl + "/#/email_verification/" + encryptedEmail;

    var locals = {
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        fullname: user.fullname,
        verificationLink: verificationLink
    };

    sendEmail(from, to, subject, 'emailVerification', locals);

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

    smtpTransport.sendMail(mail, function(err, responseStatus) {
        if (err) {
            console.log(err);
        } else {
            console.log(responseStatus.message);
        }
    });
};

module.exports = {
    encryptEmail: encryptEmail,
    sendEmail: sendEmail,
    sendEmailVerification: sendEmailVerification,
    sendCalInvite: sendCalInvite
};