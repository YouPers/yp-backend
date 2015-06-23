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
    .usage('<translationfile.json>')
//    .option('-p, --peppers', 'Add peppers')
//    .option('-P, --pineapple', 'Add pineapple')
  //  .option('-b, --bbq', 'Add bbq sauce')
  //    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(process.argv);

var transObjs = require(program.args[0]);
var locale = 'en';

console.log('found translated objs: ' + transObjs.length);

_.forEach(transObjs, function(transObj) {
    var id = transObj.id;
    if (!id) {
        console.log("invalid translation Object found: " + JSON.stringify(transObj));
    }
//    mongoose.model('AssessmentQuestion').findById(id).exec(function (err, dbObject) {
    mongoose.model('Idea').findById(id).exec(function (err, dbObject) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        if (!dbObject) {
            console.log('Cannot import transObj, no db obj found: ' + JSON.stringify(transObj));
            process.exit(1);
        }
        console.log('processing id: '+ id + ' found ' + (dbObject && dbObject.id));
        _.forEach(_.keys(transObj), function (prop) {
            if (prop !== 'id') {
                console.log('property: ' + prop + ' locale: '+locale +' value: ' + transObj[prop]);
                    dbObject[prop+'I18n'][locale] = transObj[prop];
                    dbObject.save(function(err) {
                        if (err) {
                            console.log(JSON.stringify(err));
                        }
                    });
            }
        });
    });
});
