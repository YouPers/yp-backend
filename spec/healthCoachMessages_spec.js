require('../src/util/database').initialize(false);

var HealthCoach = require('../src/core/HealthCoach'),
    consts = require('./testconsts'),
    mongoose = require('mongoose'),
    _ = require('lodash'),
    moment = require('moment');


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
                    timestamp: new Date(),
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

                        result.timestamp = moment().subtract(10, 'd').toDate();
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

                var ActivityPlan = mongoose.model('ActivityPlan');
                new ActivityPlan(
                    {
                        owner: user._id,
                        activity: consts.aloneActivity.id,
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
                    }
                ).save(function (err, savedPlan) {
                        expect(err).toBeNull();
                        expect(savedPlan).toBeDefined();
                        hc.getCurrentMessages(user, 'home.content', function (err, messages, facts) {
                            expect(err).toBeNull();
                            expect(_.isArray(messages));
                            expect(messages.length).toEqual(1);
                            expect(messages[0]).toEqual('hcmsg.1');
                            savedPlan.remove();
                            user.remove();
                            done();
                        });


                    });


            });

    });
});