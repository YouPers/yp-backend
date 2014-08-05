describe('Send Summary Email', function() {

    var log = require('../src/util/log').logger,
    mongoose = require('mongoose'),
    moment = require('moment'),
    db = require('../src/util/database'),
    mailBatch = require('../src/batches/eventsSummaryMail');

    beforeEach(function () {
        db.initialize(false);
    });

    it('should send an email for the given user', function(done) {
        mailBatch.sendSummaryMail( '52a97f1650fca98c29000007', moment().subtract('d',1), moment().add('d',1), function(err) {
            expect(err).toBeUndefined();
            return done();
        }, {log: log, i18n: require('i18next')});
    });

    afterEach(function() {
        mongoose.connection.close();
//        email.closeConnection();
    });


});