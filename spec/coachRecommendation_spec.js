require('../src/util/database').initialize(false);
var CoachRecommendation = require('../src/core/CoachRecommendation');
var consts = require('./testconsts');


describe('CoachRecommendation Module', function () {

    it('should correctly calculate recs for a user with a give AssessmentResult', function (done) {

        var assResult = {owner: consts.users.test_ind1.id,
            assessment: '525faf0ac558d40000000005',
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
        CoachRecommendation.generateAndStoreRecommendations(consts.users.test_ind1.id,consts.topic.id ,[], assResult, null, false,function(err, recs) {
            expect(err).toEqual(null);
            expect(recs.length).toBeGreaterThan(6);
            expect(recs.length).toBeLessThan(11);
            if (recs.length > 4) {
                expect(recs[0].score >= recs[1].score).toBe(true);
                expect(recs[1].score >= recs[2].score).toBe(true);
                expect(recs[recs.length - 2].score >= recs[recs.length - 1].score).toBe(true);
                expect(recs.length).toEqual(10);
            }
            return done();
        });

    });
});