require('../src/util/database').initialize(false);
var CoachRecommendation = require('../src/core/CoachRecommendation');
var consts = require('./testconsts');


describe('CoachRecommendation Module', function () {

    it('should correctly calculate recs for a user with a give AssessmentResult', function (done) {

        var assResult = {owner: consts.users.test_ind1.id,
            assessment: '525faf0ac558d40000000005',
            timestamp: new Date(),
            answers: [
                {assessment: '525faf0ac558d40000000005',
                    question: '5278c51a6166f2de240000cc',
                    answer: -100,
                    answered: true},
                {assessment: '525faf0ac558d40000000005',
                    question: '5278c51a6166f2de240000cb',
                    answer: 100,
                    answered: true}
            ]
        };
        CoachRecommendation.updateRecommendations(consts.users.test_ind1.id, [], assResult, null, function(err, recs) {
            console.log(JSON.stringify(recs));
            if (err) {
                console.log(JSON.stringify(err));
            }
            expect(err).toBeNull();
            expect(recs.length).toBeGreaterThan(6);
            expect(recs.length).toBeLessThan(11);
            if (recs.length > 4) {
                expect(recs[0].score >= recs[1].score).toBe(true);
                expect(recs[1].score >= recs[2].score).toBe(true);
                expect(recs[recs.length - 2].score >= recs[recs.length - 1].score).toBe(true);
            }
            return done();
        });

    });

    it('should store the recommendations in the ActivityOffers Collection', function(done) {

       return done();
    });

    it('should close db', function(done) {
        require('mongoose').disconnect();
        return done();
    });
});