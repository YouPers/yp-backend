/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 10.12.13
 * Time: 11:45
 * To change this template use File | Settings | File Templates.
 */
var nodemailer = require('nodemailer');

var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Mailjet",
    auth: {
        user: "785bb8e4ce318859e0c786257d39f99e",
        pass: "ba3fdc7db0242a16100625394b587085"
    }
});

var sendEmail = function(from, to, subject, text, html) {
    var mail = {
        from: from, // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: text, // plaintext body
        html: html // html body
    };

    smtpTransport.sendMail(mail, function (error, response) {
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }

    });
};

module.exports = {
    send: sendEmail
};