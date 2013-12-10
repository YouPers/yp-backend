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
                            from: from, // sender address
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



module.exports = {
    send: sendEmail
};