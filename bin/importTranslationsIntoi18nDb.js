#!/usr/local/bin/node

/**
 * Module dependencies.
 */

var program = require('commander');
var _ = require('lodash');

program
    .version('0.0.1')
    .usage('<translationfile.json> <dbfile.json> <locale> <objname>')
//    .option('-p, --peppers', 'Add peppers')
//    .option('-P, --pineapple', 'Add pineapple')
  //  .option('-b, --bbq', 'Add bbq sauce')
  //    .option('-c, --cheese [type]', 'Add the specified type of cheese [marble]', 'marble')
    .parse(process.argv);

var transObjs = require(program.args[0]);
var dbObjects = require(program.args[1]);
var locale = program.args[2];
var objName = program.args[3];


_.forEach(dbObjects, function(dbObj) {
    var id = dbObj._id.$oid;

    _.forOwn(dbObj, function(val, key) {
        if (key.indexOf('I18n') !== -1) {
            // we have an i18n key, now we find the translation for it

            // the translations for this obj
            var translatedObj = transObjs[objName][id];
            var translatedSegment = '';
            if (translatedObj) {
                translatedSegment = translatedObj[key.substring(0,key.length-4)];
            } else {
                console.error("no translations found for obj: " + id + ", key: " + key);
            }

            dbObj[key][locale] = translatedSegment;
        }
    });
});

console.log(JSON.stringify(dbObjects, null, 2));
