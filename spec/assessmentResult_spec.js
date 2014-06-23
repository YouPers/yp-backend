require('../src/util/database').initialize(false);

var mongoose = require('mongoose'),
    AssessmentResult = mongoose.model('AssessmentResult');


describe('AssessmentResult', function () {
    var calcFn = AssessmentResult.schema.calcNeedForActionFn;
    var questionsById = {
        '1': {category: 'work'},
        '2': {category: 'work'},
        '3': {category: 'leisure'},
        '4': {category: 'work'},
        '5': {category: 'handling'}
    };

    it('should correctly calculate needForAction for two high answers', function (done) {
        var myResult = {
            answers: [{question:  '1', answer: 90}, {question:  '2', answer: 100}]
        };

        var nForA = calcFn(myResult.answers, questionsById);
        expect(nForA.work).toEqual(9);
        done();
    });

    it('should correctly calculate needForAction for three high answers', function (done) {
        var myResult = {
            answers: [{question:  '1', answer: 90}, {question: '2', answer: 100}, {question: '4', answer: 100}]
        };

        var nForA = calcFn(myResult.answers, questionsById);
        expect(nForA.work).toEqual(10);
        done();
    });

    it('should correctly calculate needForAction for three mid answers', function (done) {
        var myResult = {
            answers: [{question: '1', answer: 40}, {question:  '2', answer: -50}, {question: '4', answer: -60}]
        };

        var nForA = calcFn(myResult.answers, questionsById);
        expect(nForA.work).toEqual(7);
        done();
    });
});
