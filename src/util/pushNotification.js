var apn = require('apn');

var options = {
    cert: 'certs/yp_balance_cert.pem',
    key: 'certs/yp_balance_key_noenc.pem',
    passphrase: ''

};

var service = new apn.Connection(options);

service.on('connected', function() {
    console.log("Connected");
});

service.on('transmitted', function(notification, device) {
    console.log("Notification transmitted to:" + device.token.toString('hex'));
});

service.on('transmissionError', function(errCode, notification, device) {
    console.error("Notification caused error: " + errCode + " for device ", device, notification);
});

service.on('timeout', function () {
    console.log("Connection Timeout");
});

service.on('disconnected', function() {
    console.log("Disconnected from APNS");
});

service.on('socketError', console.error);



var sendNotificationFn = function(device, message) {

    console.log("sending message to device: " + device[0]);
    var myDevice = new apn.Device(device[0].token);

    var note = new apn.Notification();

    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = 3;
    note.sound = "ping.aiff";
    note.alert = "\uD83D\uDCE7 \u2709 You have a new message";
    note.payload = {'messageFrom': 'Caroline'};

    service.pushNotification(note, myDevice);

};

module.exports = {
    sendNotification: sendNotificationFn
};