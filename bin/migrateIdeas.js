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
    .find()
    .exec(function(err, ideas) {

        _.forEach(ideas, function(idea) {
            console.log("handling idea: " +idea.number);
            idea.picture = "https://dxjlk9p2h4a7j.cloudfront.net/ideas/" + idea.number + ".jpg";
            idea.save(function(err, saved) {
                if (err) {
                    console.log(err);
                }
                console.log("idea saved: " + saved.number);
            });
        });
    });

