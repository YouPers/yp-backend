var apn = require('apn');

var options = {
    cert: '../certs/yp_balance_cert.pem',
    key: '../certs/yp_balance_key.pem'
};

var apnConnection = new apn.Connection(options);

var sendNotificationFn = function(device, message) {

    console.log("sending message to device: " + device[0]);
    var myDevice = new apn.Device(device[0].token);

    var note = new apn.Notification();

    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    note.badge = 3;
    note.sound = "ping.aiff";
    note.alert = "\uD83D\uDCE7 \u2709 You have a new message";
    note.payload = {'messageFrom': 'Caroline'};

    apnConnection.pushNotification(note, myDevice);

};

module.exports = {
    sendNotification: sendNotificationFn
};