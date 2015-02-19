#!/usr/local/bin/node

/**
 * Module dependencies.
 */
var program = require('commander');
var _ = require('lodash');
var mongoose = require('ypbackendlib').mongoose;

require('../src/util/database').initializeDb();
var Idea = mongoose.model('Idea');

program
    .version('0.0.1')
    .usage('<translationfile.json>')
//    .option('-p, --peppers', 'Add peppers')
//    .option('-P, --pineapple', 'Add pineapple')
  //  .option('-b, --bbq', 'Add bbq sauce')
  //    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(process.argv);

var transObjs = require(program.args[0]);

console.log('found translated objs: ' + transObjs.length);

_.forEach(transObjs, function(transObj) {
    var id = transObj.id;
    Idea.findById(id).exec(function (err, idea) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        console.log('processing id: ' + idea.id);
        _.forEach(_.keys(transObj), function (prop) {
            if (prop !== 'id') {
                console.log('property: ' + prop);
                _.forEach(_.keys(transObj[prop]), function (locale) {
                    idea[prop][locale] = transObj[prop][locale];
                    idea.save();
                });
            }
        });
    });
});
