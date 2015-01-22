describe('Send Summary Email', function() {
    var config = require('../src/config/config');
    var ypbackendlib = require('ypbackendlib');
    var log = ypbackendlib.log(config);
    var mongoose = ypbackendlib.mongoose,
        moment = require('moment'),
        mailBatch = require('../src/batches/eventsSummaryMail'),
        _ = require('lodash');


    beforeEach(function () {
// initialize Database
        var modelNames = require('../src/models').modelNames;

        var schemaNames = ['user']; // schema names to be extended
        var modelPath = __dirname + '/../src/models'; // path the schema extensions are located
        var schemaExtensions = {};
        _.forEach(schemaNames, function (name) {
            schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
        });
        ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);
    });

    it('should send an email for the given user', function(done) {
        mailBatch.sendSummaryMail( '52a97f1650fca98c29000006', moment().subtract(1, 'd'), moment().add(1, 'd'), function(err) {
            if (err) {
                log.error(err);
            }
            expect(err).toBeUndefined();
            return done();
        }, {log: log, i18n: ypbackendlib.i18n.initialize()});
    });

    afterEach(function() {
        mongoose.connection.close();
//        email.closeConnection();
    });


});