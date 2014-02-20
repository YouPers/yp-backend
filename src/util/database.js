
var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    mongoose = require('mongoose'),
    fs = require("fs");



var initialize = function initialize (swagger) {
    // Setup Database Connection
    var connectStr = config.db_prefix + '://';
    if (config.db_user && config.db_password) {
        connectStr += config.db_user + ':' + config.db_password + '@';
    }
    connectStr += config.db_host + ':' + config.db_port + '/' + config.db_database;

    console.log(connectStr);
    mongoose.connect(connectStr, {server: {auto_reconnect: true}});

    // Bootstrap models
    fs.readdirSync('./src/models').forEach(function (file) {
        if (file.indexOf('_model.js') !== -1) {
            console.log("Loading model: " + file);
            var model = require('../models/' + file);
            if (model.getSwaggerModel) {
                swagger.addModels(model.getSwaggerModel());
            }
        }
    });
};

module.exports = {
    initialize: initialize
};