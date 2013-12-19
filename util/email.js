var path           = require('path'),
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


var sendEmail = function (from, to, subject, text, html) {
    emailTemplates(templatesDir, function (err, template) {
        if (err) {
            console.log(err);
        } else {
            var locals = {
                email: to,
                name: {
                    first: 'Mamma',
                    last: 'Mia'
                }
            };

            // Send a single email
            template('signupEmailVerification', locals, function (err, html, text) {
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
    send: sendEmail,
    sendCalInvite: sendCalInvite
};