#!/usr/local/bin/node

/**
 * Module dependencies.
 */

var program = require('commander');
var _ = require('lodash');
var mongoose = require('ypbackendlib').mongoose;

require('../src/util/database').initializeDb();

program
    .version('0.0.1')
    .usage('')
//    .option('-p, --peppers', 'Add peppers')
//    .option('-P, --pineapple', 'Add pineapple')
    //  .option('-b, --bbq', 'Add bbq sauce')
    //    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(process.argv);

mongoose
    .model('Assessment')
    .find({topic: mongoose.Types.ObjectId('53b416fba43aac62a2debda2')})
    .populate('questions', '_id exptextI18n maxtextI18n midtextI18n midtextexampleI18n mintextI18n mintextexampleI18n titleI18n maxtextexampleI18n')
    .exec(function(err, ass) {
        if (err) {
            console.log(JSON.stringify(err));
            return;
        }
        console.log(JSON.stringify(ass[0].questions, null, 2));
        console.error('wrote objects:' + ass[0].questions.length);
        //var wordsTotal = _.reduce(ideas, function(sum, idea) {return sum + idea.text.split(' ').length + idea.title.split(' ').length + idea.description.split(' ').length;}, 0);
        //var wordsAvgTitel = _.reduce(ideas, function(sum, idea) {return sum + idea.title.split(' ').length;}, 0) / ideas.length;
        //var wordsAvgDescription = _.reduce(ideas, function(sum, idea) {return sum + idea.description.split(' ').length;}, 0) / ideas.length;
        //var wordsAvgText = _.reduce(ideas, function(sum, idea) {return sum + idea.text.split(' ').length;}, 0) / ideas.length;
        //console.error('words to translate: ' + wordsTotal);
        //console.error('words in titel Avg: ' + wordsAvgTitel);
        //console.error('words in Description Avg: ' + wordsAvgDescription);
        //console.error('words in Text Avg: ' + wordsAvgText);
        mongoose.disconnect();
    });
