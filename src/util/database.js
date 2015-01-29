var ypbackendlib = require('ypbackendlib'),
    config = require('../config/config'),
    _ = require('lodash');

function initializeDb () {
    // initialize Database
    var modelNames = require('../models').modelNames;

    var schemaNames = ['user']; // schema names to be extended
    var modelPath = __dirname + '/../models'; // path the schema extensions are located
    var schemaExtensions = {};
    _.forEach(schemaNames, function (name) {
        schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
    });
    ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);
}


module.exports = {
    initializeDb: initializeDb
};
