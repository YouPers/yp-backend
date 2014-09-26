describe('Send Summary Email', function() {
    var config = require('../src/config/config');
    var ypbackendlib = require('ypbackendlib');
    var log = ypbackendlib.log(config);
    var mongoose = ypbackendlib.mongoose,
    moment = require('moment'),
    mailBatch = require('../src/batches/eventsSummaryMail');
    var modelNames = require('../src/models').modelNames;


    beforeEach(function () {
        ypbackendlib.initializeDb(config, modelNames, __dirname.replace('/spec', '/src/models'));
    });

    it('should send an email for the given user', function(done) {
        mailBatch.sendSummaryMail( '52a97f1650fca98c29000007', moment().subtract(1, 'd'), moment().add(1, 'd'), function(err) {
            expect(err).toBeUndefined();
            return done();
        }, {log: log, i18n: ypbackendlib.i18n.initialize()});
    });

    afterEach(function() {
        mongoose.connection.close();
//        email.closeConnection();
    });


});