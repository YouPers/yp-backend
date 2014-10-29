#!/usr/local/bin/node


var http = require('http');
var _ = require('lodash');
var fs = require('fs');
var xlsx = require('xlsx');
var async = require('async');


var Client = require('node-rest-client').Client;

process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});

if(!process.argv[2]) {
    throw "usage: node importAssessments.js <input.xlsx> [http://endpoint:PORT]";
}

var defaultEndpoint = 'http://localhost:8000';
var endpoint = process.argv[3] || defaultEndpoint;
var auth={user:"test_prodadm",password:"yp"};
var client = new Client(auth);

var workbook = xlsx.readFile(process.argv[2]);


var assessments = {
//    'Gesunde Ernährung': {
//
////        id: '525faf0ac558d40000000006',
//        nameI18n: {
//            de: 'Beurteile Deinen Ernährung'
//        },
//        topic: '53b416fba43aac62a2debda2',
//        questions: []
//    },
//    'Körperliche Fitness': {
//
//        nameI18n: {
//            de: 'Beurteile Deine Fitness'
//        },
//        topic: '53b416fba43aac62a2debda3',
//        questions: []
//    }
//    ,
    'Gesundes Arbeiten': {

        nameI18n: {
            de: 'Beurteile Deine Gesundheit bei der Arbeit'
        },
        topic: '53b416fba43aac62a2debda4',
        questions: []
    },
    'Sicheres Arbeiten': {

        nameI18n: {
            de: 'Beurteile Deine Sicherheit bei der Arbeit'
        },
        topic: '53b416fba43aac62a2debda5',
        questions: []
    }
};


_.forEach(_.keys(workbook.Sheets), function (sheetName) {

    if(!assessments[sheetName]) {
        return; // skip the other assessments for now, until the structure is fixed
    }

    var sheet = workbook.Sheets[sheetName];


    _.forEach(_.keys(sheet), function (key) {

        if( key.indexOf('B') === 0 ) {

            var row = parseInt(key.substr(1));

            if(row >= 4) {


                var cat = sheet[key].v;
                if(cat) {

                    function getValue(col, row) {
                        return sheet[col + row] ? sheet[col + row].v : '';
                    }

                    var question = {

                        category: cat,
                        title: getValue('C', row),
                        exptext: getValue('D', row),
                        mintext: getValue('E', row),
                        mintextexample: getValue('F', row),
                        midtext: getValue('G', row),
                        midtextexample: getValue('H', row),
                        maxtext: getValue('I', row),
                        maxtextexample: getValue('J', row)

                    };

                    var hasMin = question.mintext.trim().length > 0;
                    var hasMax = question.maxtext.trim().length > 0;

                    question.type = (hasMin && hasMax) ? 'twoSided' : (hasMin ? 'leftSided' : 'rightSided');

                    var assessment = assessments[sheetName];
                    assessment.questions.push(question);

                }

            }

        }

    });
});

_.forEach(assessments, function (assessment) {

    var assessmentOnly = _.clone(assessment);
    delete assessmentOnly.questions;

    var args = {

        headers:{
            "Content-Type": "application/json"
        } ,
        data: assessmentOnly
    };

    client.post(endpoint + '/assessments', args, function(data, response){
        // parsed response body as js object
//                console.log(data);
//                // raw response
//                console.log(response);

        assessment.id = assessmentOnly.id = data.id;
        assessmentOnly.questions = [];
        updateQuestions(assessment);
    });

    function updateQuestions(assessment) {

        async.each(assessment.questions, function (question, done) {

            question.assessment = assessment.id;

            var args = {

                headers:{
                    "Content-Type": "application/json"
                } ,
                data: question
            };

            client.post(endpoint + '/assessments/' + assessment.id + '/questions', args, function(data, response){

                assessmentOnly.questions.push(data.id);
                done();

            });

        }, function(err) {

            var args = {

                headers:{
                    "Content-Type": "application/json"
                } ,
                data: assessmentOnly
            };

            client.put(endpoint + '/assessments/' + assessmentOnly.id, args, function(data, response){
                // parsed response body as js object
                console.log(data);
            });

        });





    }

});

