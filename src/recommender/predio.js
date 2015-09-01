var config = require('../config/config'),
    mongoose = require('ypbackendlib').mongoose,
    moment = require('moment'),
    request = require('request-json'),
    log = require('ypbackendlib').log(config);

var predioClient = request.createClient(config.predio.URL, {
    qs: {
        accessKey: config.predio.accessKey
    }
});



mongoose.model('User').on('add', function (user) {

    var data = {
        event: "$set",
        entityType: "user",
        entityId: user.id,
        eventTime: moment().toISOString()
    };
    log.debug({user: user.id, data: data}, "adding user to predictionIO");

    predioClient.post('events.json', data, function (err, result, body) {
        if (err || (result.statusCode >= 400)) {
            log.error({err: err, result: result, body: body}, "Error posting new user to predio");
        } else {
            log.debug({result: result, body: body}, "Saved new user to predIo");
        }
    });
});




