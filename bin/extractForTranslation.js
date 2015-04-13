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
    .model('Idea')
    .find({topics: mongoose.Types.ObjectId('53b416fba43aac62a2debda3')})  // topic Fitness
    .and({topics: {$ne: mongoose.Types.ObjectId('53b416cfa43aac62a2debda1')}})   // not topic Stress
    .select('_id textI18n descriptionI18n titleI18n')
    .exec(function(err, ideas) {
        console.log(JSON.stringify(ideas, null, 2));
        console.error('wrote objects:' + ideas.length);
        var wordsTotal = _.reduce(ideas, function(sum, idea) {return sum + idea.textI18n.de.split(' ').length + idea.titleI18n.de.split(' ').length + idea.descriptionI18n.de.split(' ').length;}, 0);
        var wordsAvgTitel = _.reduce(ideas, function(sum, idea) {return sum + idea.titleI18n.de.split(' ').length;}, 0) / ideas.length;
        var wordsAvgDescription = _.reduce(ideas, function(sum, idea) {return sum + idea.descriptionI18n.de.split(' ').length;}, 0) / ideas.length;
        var wordsAvgText = _.reduce(ideas, function(sum, idea) {return sum + idea.textI18n.de.split(' ').length;}, 0) / ideas.length;
        console.error('words to translate: ' + wordsTotal);
        console.error('words in titel Avg: ' + wordsAvgTitel);
        console.error('words in Description Avg: ' + wordsAvgDescription);
        console.error('words in Text Avg: ' + wordsAvgText);
        mongoose.disconnect();
    });

