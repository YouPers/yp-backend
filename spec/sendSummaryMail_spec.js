describe('Send Summary Email', function() {

    var env = process.env.NODE_ENV || 'development',
    config = require('../src/config/config')[env],
    log = require('bunyan').createLogger(config.loggerOptions),
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

    it('should NOT send an email for the given user', function(done) {
        mailBatch.sendSummaryMail( '52a97f1650fca98c29000055', moment().subtract('d',1), moment().add('d',1), function(err) {
            expect(err).toBeDefined();
            expect(err.message).toBeDefined();
            expect(err.message).toEqual('error.notEnabled.dailyUserMail');
            return done();
        }, {log: log, i18n: require('i18next')});
    });

    afterEach(function() {
        mongoose.connection.close();
//        email.closeConnection();
    });


});