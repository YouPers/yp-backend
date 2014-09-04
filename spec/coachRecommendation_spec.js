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
        var options = {
            topic: consts.topic.id,
            assessmentResult: assResult,
            nrOfRecsToReturn: 5
        };
        CoachRecommendation.generateAndStoreRecommendations(consts.users.test_ind1.id, options, function (err, recs) {
            expect(err).toEqual(null);
            expect(recs.length).toBeGreaterThan(0);
            expect(recs.length).toBeLessThan(6);
            expect(recs[0].score >= recs[1].score).toBe(true);
            expect(recs[1].score >= recs[2].score).toBe(true);
            return done();
        });

    });
});