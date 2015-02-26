var lib = require('ypbackendlib'),
    db = require('../src/util/database'),
    mongoose = lib.mongoose,
    _ = require('lodash'),
    async = require('async'),
    Inspiration, user, user2, profile, SocialInteraction, EventMgr;

beforeEach(function (done) {
    db.initializeDb();
    Inspiration = require('../src/core/Inspiration');
    SocialInteraction = require('../src/core/SocialInteraction');
    EventMgr = require('../src/core/EventManagement');
    var UserModel = mongoose.model('User');

    user = new UserModel({
        username: "testInspirations",
        firstname: "test",
        lastname: "inspirations",
        fullname: "test inspirations",
        email: "unittest1+inspirations@gmail.com",
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
                    username: "testInspirations2",
                    firstname: "test2",
                    lastname: "inspirations",
                    fullname: "test inspirations",
                    email: "unittest1+inspirations2@gmail.com",
                    roles: ['individual'],
                    campaign: mongoose.Types.ObjectId('527916a82079aa8704000006'),
                    password: "yp"
                }).save(function (err, savedUser2) {
                        user2 = savedUser2;
                        return done(err);
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
                    return _deleteObjs(newInsps.concat(insps), done);
                });
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
                                insp.idea.toString() === ideaId;
                        })).toBeDefined();

                        return _deleteObjs(insps, done);
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
                                insp.idea.toString() === ideaId;
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
        profile.categories = ['publicEvents'];
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
        profile.categories = ['cultural'];
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

});

function _deleteObjs(sois, done) {
    async.forEach(sois, function (soi, next) {
        soi.remove(next);
    }, done);
}

afterEach(function (done) {
    _deleteObjs([user, user2], done);
});
