#!/usr/local/bin/node

/**
 * Module dependencies.
 */

var program = require('commander');
var _ = require('lodash');

program
    .version('0.0.1')
    .usage('<dbfile.json> <locale> <objname>')
//    .option('-p, --peppers', 'Add peppers')
//    .option('-P, --pineapple', 'Add pineapple')
  //  .option('-b, --bbq', 'Add bbq sauce')
  //    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(process.argv);

var dbObjects = require(program.args[0]);
var locale = program.args[1];
var objName = program.args[2];

var output = {};
output[objName] = {};


_.forEach(dbObjects, function(obj) {
    var id = obj._id.$oid;

    _.forOwn(obj, function(val, key) {
        if (key.indexOf('I18n') !== -1) {
            if (!output[objName][id]) {
                output[objName][id] = {};
            }
            output[objName][id][key.substring(0,key.length-4)] = val[locale];
        }
    });
});

console.log(JSON.stringify(output, null, 2));
