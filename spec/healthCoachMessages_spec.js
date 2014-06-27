require('../src/util/database').initialize(false);

var HealthCoach = require('../src/core/HealthCoach'),
    consts = require('./testconsts'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment'),
    env = process.env.NODE_ENV || 'development',
    config = require('../src/config/config')[env],
    Logger = require('bunyan'),
    log = new Logger(config.loggerOptions),
    ypi18n = require('../src/util/ypi18n');


describe('HealthCoach Module', function () {

    it('should display empty assessment hint and plan activity hint for virgin user', function (done) {
        var hc = new HealthCoach();

        consts.newUser(function (err, user) {
            expect(err).toBeNull();
            expect(user).toBeDefined();
            hc.getCurrentMessages(user, 'home.content', function (err, messages, facts) {
                expect(err).toBeNull();
                expect(_.isArray(messages));
                expect(messages.length).toEqual(2);
                expect(messages[0]).toEqual('hcmsg.1');
                expect(messages[1]).toEqual('hcmsg.3');
                user.remove();
                done();
            });
        });
    });

    it('should NOT display assessment hint if user has filled out assessment', function (done) {
        var hc = new HealthCoach();

        consts.newUser(function (err, user) {
                expect(err).toBeNull();
                expect(user).toBeDefined();

                var result = {
                    owner: user._id,
                    assessment: consts.assessment.id,
                    answers: []
                };
                var AssRes = mongoose.model('AssessmentResult');

                new AssRes(result).save(function (err, result) {
                    expect(err).toBeNull();
                    expect(result).toBeDefined();
                    hc.getCurrentMessages(user, 'home.content', function (err, messages, facts) {
                        expect(err).toBeNull();
                        expect(_.isArray(messages));
                        expect(messages.length).toEqual(1);

                        result.created = moment().subtract(10, 'd').toDate();
                        result.save(function (err, updatedResult) {
                            expect(err).toBeNull();
                            hc.getCurrentMessages(user, 'home.content', function (err, messages, facts) {
                                expect(err).toBeNull();
                                expect(_.isArray(messages));
                                expect(messages.length).toEqual(2);
                                expect(messages[0]).toEqual('hcmsg.2');
                                result.remove();
                                user.remove();
                                done();
                            });

                        });


                    });
                });
            });
    });

    it('should not display activity hint after user has planned activity', function (done) {
        var hc = new HealthCoach();

        consts.newUser(function (err, user) {
                expect(err).toBeNull();
                expect(user).toBeDefined();

                var activityPlanHandler = require('../src/handlers/activityplan_handlers');
                var req = {};
                req.log = log;
                req.i18n = ypi18n.initialize();
                req.body = {
                        owner: user.id,
                        idea: consts.aloneIdea.id,
                        "title": "myTitle",
                        "visibility": "private",
                        "executionType": "self",
                        "mainEvent": {
                            "start": "2014-06-16T12:00:00.000Z",
                            "end": "2014-06-16T13:00:00.000Z",
                            "allDay": false,
                            "frequency": "once"
                        },
                        "status": "active"
                    };

                req.user = user;

                var res = {send: function(code, body){
                    res.code = code;
                    res.body = body;
                }};

            activityPlanHandler.postNewActivityPlan(req, res,
            function (err) {
                        expect(err).toBeUndefined();
                        hc.getCurrentMessages(user, 'home.content', function (err, messages, facts) {
                            console.log(messages);
                            expect(err).toBeNull();
                            expect(_.isArray(messages));
                            expect(messages.length).toEqual(1);
                            expect(messages[0]).toEqual('hcmsg.1');
                            expect(messages).not.toContain('hsmsg.3');
                            user.remove();
                            mongoose.model('ActivityEvent').remove({activityPlan: res.body._id}).exec();

                            res.body.remove();
                            done();
                        });
                    });
            });

    });
});