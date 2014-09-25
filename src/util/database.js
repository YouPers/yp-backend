var mongoose = require('mongoose'),
    _ = require('lodash'),
    swagger = require("swagger-node-restify");


var initialize = function initialize(config, models) {

    if (mongoose.connection.readyState === 0) {
        // Setup Database Connection
        var connectStr = config.db_prefix + '://';
        if (config.db_user && config.db_password && config.db_user !== 'None' && config.db_password !== 'None') {
            connectStr += config.db_user + ':' + config.db_password + '@';
        }
        connectStr += config.db_host + ':' + config.db_port + '/' + config.db_database;

        console.log(connectStr);
        mongoose.connect(connectStr, {server: {auto_reconnect: true}});

        _.forEach(models, function (modelName) {
            console.log("Loading model: " + modelName);
            var model = require('../models/' + modelName + '_model');
            if (model.getSwaggerModel) {
                swagger.addModels(model.getSwaggerModel());
            }
        });
    }
};

module.exports = {
    initialize: initialize
};