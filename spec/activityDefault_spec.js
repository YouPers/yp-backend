var ypbackendlib = require('ypbackendlib');
var config = require('../src/config/config');
var modelNames = require('../src/models').modelNames;
var mongoose = require('ypbackendlib').mongoose;
var _ = require('lodash');
var log = require('ypbackendlib').log(config);

var schemaNames = ['user']; // schema names to be extended
var modelPath = __dirname + '/../src/models'; // path the schema extensions are located
var schemaExtensions = {};
_.forEach(schemaNames, function (name) {
    schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
});
ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);

var actMgr = require('../src/core/ActivityManagement');
var consts = require('./testconsts');

var user;

beforeEach(function (done) {
    console.log("beforeEach executed");
    mongoose.model('User').findById(consts.users.test_ind1.id).select('+profile +campaign').populate('profile campaign').exec(function (err, myUser) {
        console.log("beforeEach executed: cb");
        if (err) {
            throw(err);
        }
        if (!myUser) {
            throw new Error("user not found");
        }
        console.log("beforeEach executed: user found");

        user = myUser;
        return done();
    });
});

describe('ActivityManagement Module: ', function () {

    describe('DefaultActivityMethod', function () {

        it('should correctly return a simple default activity', function (done) {

            mongoose.model('Idea').findById(consts.aloneIdea.id, function (err, idea) {
                if (err) {
                    return done(err);
                }
                var act = actMgr.defaultActivity(idea, user, user.campaign.id);
                log.error(act);
                expect(act).toBeDefined();
                return done();

            });

        });

    });
});
