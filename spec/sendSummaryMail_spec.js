describe('Send Summary Email', function () {
    var config = require('../src/config/config');
    var ypbackendlib = require('ypbackendlib');
    var log = ypbackendlib.log(config);
    var mongoose = ypbackendlib.mongoose,
        moment = require('moment'),
        mailBatch = require('../src/batches/dailySummaryMail');


    beforeEach(function () {
        require('../src/util/database').initializeDb();
    });

    it('should send an email for the given user', function (done) {
        mongoose.model('User')
            .findById('52a97f1650fca98c29000006')
            .select('+profile +campaign +username +email')
            .populate('profile')
            .populate('campaign')
            .exec(function (err, user) {
                if (err) {
                    log.error(err);
                    return done(err);
                }
                mailBatch.sendMail(user, moment().subtract(1, 'd'), moment().add(1, 'd'), function (err) {
                    console.log('okokok2');
                    if (err) {
                        log.error(err);
                    }
                    expect(err).toBeUndefined();
                    return done();
                }, {log: log, i18n: ypbackendlib.i18n.initialize()});
            });
    });

    afterEach(function () {
        mongoose.connection.close();
//        email.closeConnection();
    });


});