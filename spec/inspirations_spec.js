var lib = require('ypbackendlib'),
    db = require('../src/util/database'),
    mongoose = lib.mongoose,
    _ = require('lodash'),
    async = require('async'),
    moment = require('moment'),
    i18n = lib.i18n.initialize(),
    user, user2, profile;

db.initializeDb();
var Inspiration = require('../src/core/Inspiration');
var SocialInteraction = require('../src/core/SocialInteraction');
var EventMgr = require('../src/core/EventManagement');

beforeEach(function (done) {

    var UserModel = mongoose.model('User');

    var rnd1 = Math.floor((Math.random() * 10000) + 1);
    var rnd2 = Math.floor((Math.random() * 10000) + 1);

    user = new UserModel({
        username: "testInspirations" + rnd1,
        firstname: "test",
        lastname: "inspirations",
        fullname: "test inspirations",
        email: "unittest1+inspirations" + rnd1 + "@gmail.com",
        roles: ['individual'],
        campaign: mongoose.Types.ObjectId('527916a82079aa8704000006'),
        password: "yp"
    }).save(function (err, savedUser) {
            if (err) {
                return done(err);
            }
            UserModel.findById(savedUser._id).select('+profile +campaign').populate('profile campaign').exec(function (err, loadedUser) {
                if (err) {
                    return done(err);
                }
                user = loadedUser;
                profile = user.profile;

                user2 = new UserModel({
                    username: "testInspirations2" + rnd2,
                    firstname: "test2",
                    lastname: "inspirations",
                    fullname: "test inspirations",
                    email: "unittest1+inspirations2" + rnd2 + "@gmail.com",
                    roles: ['individual'],
                    campaign: mongoose.Types.ObjectId('527916a82079aa8704000006'),
                    password: "yp"
                }).save(function (err, savedUser2) {

                        UserModel.findById(savedUser2._id).select('+profile +campaign')
                            .populate('profile campaign').exec(function (err, loadedUser2) {
                                if (err) {
                                    return done(err);
                                }
                                user2 = loadedUser2;
                                return done(err);
                            });
                    });
            });
        });
});


describe('inspirations idea Match score fn', function () {
    var idea = {
        qualityFactor: 5,
        titleI18n: {en: 'testidea'},
        coach: 'testCoach1',
        categories: ['testCat1', 'testCat2'],
        topics: ['53b416cfa43aac62a2debda1', '53b416fba43aac62a2debda3']
    };

    var params = {
        userCoach: '',
        userCats: [],
        futurePlanCount: 0,
        pastPlanCount: 0,
        openInvitationCount: 0,
        dismissalsCount: 0
    };

    var initial = Inspiration.getIdeaMatchScore(idea, params);


    it('needs to return qf if anything else is empty', function () {
            expect(Inspiration.getIdeaMatchScore(idea, params)).toEqual(idea.qualityFactor);
        }
    );

    it('needs to increase when cats match', function () {
            var myParams = _.clone(params);
            myParams.userCats = ['testCat1'];
            var oneMatch = Inspiration.getIdeaMatchScore(idea, myParams);
            myParams.userCats = ['testCat1', 'testCat2'];
            var twoMatches = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(oneMatch).toBeGreaterThan(initial);
            expect(twoMatches).toBeGreaterThan(oneMatch);
        }
    );

    it('needs to increase when coach match', function () {
            var myParams = _.clone(params);
            myParams.userCoach = 'alex';
            var oneMatch = Inspiration.getIdeaMatchScore(idea, myParams);
            myParams.userCoach = 'nora';
            var twoMatches = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(oneMatch).toBeGreaterThan(initial);
            expect(twoMatches).toBeGreaterThan(oneMatch);
        }
    );

    it('needs to decrease when planned in future', function () {
            var myParams = _.clone(params);
            myParams.futurePlanCount = 1;
            var newScore = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(newScore).toBeLessThan(initial);
        }
    );

    it('needs to increase when planned in past', function () {
            var myParams = _.clone(params);
            myParams.pastPlanCount = 1;
            var newScore = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(newScore).toBeGreaterThan(initial);
        }
    );

    it('needs to decrease when dismissed in past', function () {
            var myParams = _.clone(params);
            myParams.dismissalsCount = 1;
            var newScore = Inspiration.getIdeaMatchScore(idea, myParams);
            myParams.dismissalsCount = 2;
            var newScore2 = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(newScore).toBeLessThan(initial);
            expect(newScore2).toBeLessThan(newScore);
        }
    );

    it('needs to decrease when invited in future', function () {
            var myParams = _.clone(params);
            myParams.openInvitationCount = 1;
            var newScore = Inspiration.getIdeaMatchScore(idea, myParams);
            expect(newScore).toBeLessThan(initial);
        }
    );

});

describe('scoring data loading module', function () {

    it('needs to load ideas but otherwise empty', function (done) {
        Inspiration.loadScoringData(user, function (err, result) {
            if (err) {
                return done(err);
            }
            expect(result.ideas.length).toBeGreaterThan(10);
            expect(result.userData).toBeDefined();
            expect(result.userData.eventCountByIdeaAndNow).toBeDefined();
            expect(_.keys(result.userData.eventCountByIdeaAndNow).length).toEqual(0);
            expect(result.userData.publicInvitations).toBeDefined();
            expect(_.keys(result.userData.publicInvitations).length).toEqual(0);
            expect(result.userData.personalInvitations).toBeDefined();
            expect(_.keys(result.userData.personalInvitations).length).toEqual(0);
            expect(result.userData.dismissalCountByIdea).toBeDefined();
            expect(_.keys(result.userData.dismissalCountByIdea).length).toEqual(0);
            return done();
        });
    });

    it('needs to reflect a planned future event', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1ab6';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                Inspiration.loadScoringData(user, function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    expect(result.userData.eventCountByIdeaAndNow[idea._id.toString() + 'future']).toEqual(1);
                    savedEvent.remove();
                    return _deleteObjs([savedEvent], done);
                });
            });
        });
    });

    it('needs to reflect an planned past event', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1ab6';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user, user.campaign).save(function (err, savedEvent) {
                if (err) {
                    return done(err);
                }
                savedEvent.start = moment().subtract(1, 'day').toDate();
                savedEvent.save(function (err, savedEvent2) {
                    Inspiration.loadScoringData(user, function (err, result) {
                        if (err) {
                            return done(err);
                        }
                        expect(result.userData.eventCountByIdeaAndNow[idea._id.toString() + 'past']).toEqual(1);
                        savedEvent.remove();
                        return _deleteObjs([savedEvent], done);
                    });
                });
            });
        });
    });

    it('should count a personal invitation ', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.loadScoringData(user, function (err, result) {
                        expect(result.userData.invitationCountByIdea[ideaId]).toEqual(1);
                        return _deleteObjs([savedEvent, inv], done);
                    });
                });
            });

        });
    });

    it('should not count a personal invitation of an event that is running right now', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            var myEvent = EventMgr.defaultEvent(idea, user2, user.campaign);
            myEvent.start = moment().subtract(1, 'hour').toDate();
            myEvent.end = moment().add(1, 'hour').toDate();
            myEvent.save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.loadScoringData(user, function (err, result) {
                        expect(result.userData.invitationCountByIdea[ideaId]).toBeUndefined();
                        return _deleteObjs([savedEvent, inv], done);
                    });
                });
            });

        });
    });

    it('should not count a personal invitation of an event that is over already', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            var myEvent = EventMgr.defaultEvent(idea, user2, user.campaign);
            myEvent.start = moment().subtract(2, 'hour').toDate();
            myEvent.end = moment().subtract(1, 'hour').toDate();
            myEvent.save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.loadScoringData(user, function (err, result) {
                        expect(result.userData.invitationCountByIdea[ideaId]).toBeUndefined();
                        return _deleteObjs([savedEvent, inv], done);
                    });
                });
            });

        });
    });

    it('should count a public invitation ', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPublicInvitation(user2, savedEvent, function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.loadScoringData(user, function (err, result) {
                        expect(result.userData.invitationCountByIdea[ideaId]).toEqual(1);
                        return _deleteObjs([savedEvent, inv], done);
                    });
                });
            });

        });
    });

    it('should count a dismissed invitation as dismissal and not as invitation anymore', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPublicInvitation(user2, savedEvent, function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    SocialInteraction.dismissSocialInteractionById(inv._id, user, {reason: 'reason'}, function (err) {
                        if (err) {
                            return done(err);
                        }
                        Inspiration.loadScoringData(user, function (err, result) {
                            expect(result.userData.invitationCountByIdea[ideaId]).toBeUndefined();
                            expect(result.userData.dismissalCountByIdea[ideaId]).toEqual(1);
                            return _deleteObjs([savedEvent, inv], done);
                        });
                    });
                });
            });

        });
    });

});

describe('inspirations recommender module', function () {

    it('needs to get 3 recs as inspirations', function (done) {
        Inspiration.getInspirations(user, function (err, insps) {
            if (err) {
                return done(err);
            }
            expect(insps).toBeDefined();
            expect(insps.length).toEqual(3);
            _.forEach(insps, function (insp) {
                expect(insp.__t).toEqual('Recommendation');
                expect(insp.idea).toBeDefined();
                expect(insp.targetSpaces.length).toEqual(1);
                expect(insp.targetSpaces[0].type).toEqual('user');
            });
            return _deleteObjs(insps, done);
        });
    });

    it('should replace a dismissed rec with another one', function (done) {
        Inspiration.getInspirations(user, function (err, insps) {
            SocialInteraction.dismissSocialInteractionById(insps[0]._id, user, {reason: 'reason'}, function (err) {
                if (err) {
                    return done(err);
                }
                Inspiration.getInspirations(user, function (err, newInsps) {
                    if (err) {
                        return done(err);
                    }
                    expect(newInsps.length).toEqual(3);
                    _.forEach(newInsps, function (newInsp) {
                        expect(newInsp.idea._id.toString()).not.toEqual(insps[0].idea._id.toString());
                    });
                    return _deleteObjs(newInsps.concat(newInsps), done);
                });
            });
        });
    });

    it('should return the same inspirations with same rec.id on two succeeding calls', function (done) {
        Inspiration.getInspirations(user, function (err, insps) {
            if (err) {
                return done(err);
            }
            Inspiration.getInspirations(user, function (err, newInsps) {
                if (err) {
                    return done(err);
                }
                for (var i = 0; i < insps.length; i++) {
                    expect(insps[i].idea.id).toEqual(newInsps[i].idea.id);
                    expect(insps[i].id).toEqual(newInsps[i].id);
                }

                _.forEach(newInsps, function (newInsp) {
                    var matchingId = _.find(insps, function (oldInsp) {
                        return oldInsp.id === newInsp.id;
                    });
                    expect(matchingId).toBeDefined();
                });

                return _deleteObjs(newInsps.concat(newInsps), done);
            });
        });
    });


    it('should include a personal invitation in the list of inspirations', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.getInspirations(user, function (err, insps) {
                        expect(_.find(insps, function (insp) {
                            return insp.__t === 'Invitation' &&
                                insp.targetSpaces[0].type === 'user' &&
                                insp.idea.id === ideaId;
                        })).toBeDefined();

                        return _deleteObjs(insps, done);
                    });
                });
            });

        });
    });

    it('should not include a personal invitation that has been dismissed', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.getInspirations(user, function (err, insps) {

                        var myInv = _.find(insps, function (insp) {
                            return insp.__t === 'Invitation' &&
                                insp.targetSpaces[0].type === 'user' &&
                                insp.idea.id === ideaId;
                        });
                        expect(myInv).toBeDefined();

                        SocialInteraction.dismissSocialInteractionById(myInv, user, {reason: 'denied'}, function (err) {
                            expect(err).toBeNull();

                            Inspiration.getInspirations(user, function (err, insps) {

                                var myInv2 = _.find(insps, function (insp) {
                                    return insp.__t === 'Invitation' &&
                                        insp.targetSpaces[0].type === 'user' &&
                                        insp.idea.id === ideaId;
                                });
                                expect(myInv2).toBeUndefined();
                                return _deleteObjs(insps, done);

                            });
                        });
                    });
                });
            });
        });
    });

    it('should not include a personal invitation of a deleted event', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1aaf';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPersonalInvitation(user2, savedEvent, [user._id.toString()], function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.getInspirations(user, function (err, insps) {

                        var myInv = _.find(insps, function (insp) {
                            return insp.__t === 'Invitation' &&
                                insp.targetSpaces[0].type === 'user' &&
                                insp.idea.id === ideaId;
                        });
                        expect(myInv).toBeDefined();

                        EventMgr.deleteEvent(savedEvent.id, user2, i18n, function (err) {
                            expect(err).toBeUndefined();

                            Inspiration.getInspirations(user, function (err, insps) {

                                var myInv2 = _.find(insps, function (insp) {
                                    return insp.__t === 'Invitation' &&
                                        insp.targetSpaces[0].type === 'user' &&
                                        insp.idea.toString() === ideaId;
                                });
                                expect(myInv2).toBeUndefined();
                                return _deleteObjs(insps, done);

                            });
                        });
                    });
                });
            });
        });
    });

    it('should include a public invitation in the list of inspirations', function (done) {
        var ideaId = '54ca2fc88c0832450f0e1ab6';
        mongoose.model('Idea').findById(ideaId).exec(function (err, idea) {
            EventMgr.defaultEvent(idea, user2, user.campaign).save(function (er, savedEvent) {
                if (err) {
                    return done(err);
                }
                SocialInteraction.createNewPublicInvitation(user2, savedEvent, function (err, inv) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.getInspirations(user, function (err, insps) {
                        expect(_.find(insps, function (insp) {
                            return insp.__t === 'Invitation' &&
                                insp.targetSpaces[0].type === 'campaign' &&
                                insp.idea.id === ideaId;
                        })).toBeDefined();

                        return _deleteObjs(insps, done);
                    });
                });
            });

        });
    });


    it('should respect the coach choice: Alex Food', function (done) {
        profile.coach = 'alex';
        profile
            .save(function (err, savedProfile) {
                user.profile = savedProfile;
                Inspiration.getInspirations(user, function (err, insps) {
                    _.forEach(insps, function (insp) {
                        expect(insp.__t).toEqual('Recommendation');
                        expect(insp.idea).toBeDefined();
                        expect(insp.targetSpaces.length).toEqual(1);
                        expect(insp.targetSpaces[0].type).toEqual('user');
                        expect(_.map(insp.idea.topics, function (topic) {
                            return topic.toString();
                        })).toContain("53b416cfa43aac62a2debda1");
                    });


                    return _deleteObjs(insps, done);
                });
            });
    });

    it('should respect the coach choice: Lisa Social', function (done) {
        profile.coach = 'lisa';
        profile
            .save(function (err, savedProfile) {
                user.profile = savedProfile;
                Inspiration.getInspirations(user, function (err, insps) {
                    _.forEach(insps, function (insp) {
                        expect(insp.__t).toEqual('Recommendation');
                        expect(insp.idea).toBeDefined();
                        expect(insp.targetSpaces.length).toEqual(1);
                        expect(insp.targetSpaces[0].type).toEqual('user');
                        expect(_.map(insp.idea.topics, function (topic) {
                            return topic.toString();
                        })).toContain("53b416fba43aac62a2debda3");
                    });


                    return _deleteObjs(insps, done);
                });
            });
    });


    it('should respect the category choice: publicEvents', function (done) {
        profile.selectedCategories = ['publicEvents'];
        profile
            .save(function (err, savedProfile) {
                user.profile = savedProfile;
                Inspiration.getInspirations(user, function (err, insps) {
                    _.forEach(insps, function (insp) {
                        expect(insp.__t).toEqual('Recommendation');
                        expect(insp.idea).toBeDefined();
                        expect(insp.targetSpaces.length).toEqual(1);
                        expect(insp.targetSpaces[0].type).toEqual('user');
                        expect(insp.idea.categories).toContain("publicEvents");
                    });


                    return _deleteObjs(insps, done);
                });
            });
    });


    it('should respect the category choice: cultural', function (done) {
        profile.selectedCategories = ['cultural'];
        profile
            .save(function (err, savedProfile) {
                user.profile = savedProfile;
                Inspiration.getInspirations(user, function (err, insps) {
                    _.forEach(insps, function (insp) {
                        expect(insp.__t).toEqual('Recommendation');
                        expect(insp.idea).toBeDefined();
                        expect(insp.targetSpaces.length).toEqual(1);
                        expect(insp.targetSpaces[0].type).toEqual('user');
                        expect(insp.idea.categories).toContain("cultural");
                    });


                    return _deleteObjs(insps, done);
                });
            });
    });

    it('should return the same thing whether populated or not', function (done) {
        Inspiration.getInspirations(user, function (err, insps) {
            if (err) {
                return done(err);
            }
            Inspiration.getInspirations(user, {
                populate: 'idea event',
                populatedeep: 'event.idea idea.topics'
            }, 'en', function (err, newInsps) {
                if (err) {
                    return done(err);
                }
                for (var i = 0; i < insps.length; i++) {
                    expect(insps[i].idea.id).toEqual(newInsps[i].idea.id);
                    expect(insps[i].id).toEqual(newInsps[i].id);
                }


                return _deleteObjs(newInsps.concat(newInsps), done);

            });
        });
    });


    it('should return the same thing whether populated or not, even after dismissing a rec', function (done) {
        Inspiration.getInspirations(user, function (err, oldinsps) {
            if (err) {
                return done(err);
            }
            SocialInteraction.dismissSocialInteractionById(oldinsps[0]._id, user, {reason: 'reason'}, function (err) {
                if (err) {
                    return done(err);
                }
                Inspiration.getInspirations(user, function (err, insps) {
                    if (err) {
                        return done(err);
                    }
                    Inspiration.getInspirations(user, {
                        populate: 'idea event',
                        populatedeep: 'event.idea idea.topics'
                    }, 'en', function (err, newInsps) {
                        if (err) {
                            return done(err);
                        }
                        for (var i = 0; i < insps.length; i++) {
                            expect(insps[i].idea.id).toEqual(newInsps[i].idea.id);
                            expect(insps[i].id).toEqual(newInsps[i].id);
                        }

                        return _deleteObjs(newInsps.concat(newInsps), done);
                    });
                });
            });
        });
    });

});
function _deleteObjs(sois, done) {
    async.forEach(sois, function (soi, next) {
        soi.remove(next);
    }, done);
}

afterEach(function (done) {
    _deleteObjs([user, user2], done);
});
