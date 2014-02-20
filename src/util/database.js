var env = process.env.NODE_ENV || 'development',
    config = require('../config/config')[env],
    mongoose = require('mongoose'),
    _ = require('lodash'),
    swagger = require("swagger-node-restify");


var initialize = function initialize(loadTestData) {
    // Setup Database Connection
    var connectStr = config.db_prefix + '://';
    if (config.db_user && config.db_password) {
        connectStr += config.db_user + ':' + config.db_password + '@';
    }
    connectStr += config.db_host + ':' + config.db_port + '/' + config.db_database;

    console.log(connectStr);
    mongoose.connect(connectStr, {server: {auto_reconnect: true}});

    var models = [
        'activity',
        'activityPlan',
        'assessment',
        'assessmentResult',
        'campaign',
        'comment',
        'goal',
        'organization',
        'profile',
        'user'];
    if (!loadTestData) {
        config.loadTestData = false;
    }
    _.forEach(models, function (modelName) {
        console.log("Loading model: " + modelName);
        var model = require('../models/' + modelName + '_model');
        if (model.getSwaggerModel) {
            swagger.addModels(model.getSwaggerModel());
        }
    });
};

module.exports = {
    initialize: initialize
};