/**
 * Main server startup and configuration commands
 */

// Load configuration
var config = require('./config/config'),
    _ = require('lodash');

if (config.NEW_RELIC_ENABLED) {
    console.log("Enabling new relic: " + config.NEW_RELIC_ENABLED);
    require('newrelic');
}

if (config.NODE_TIME_ENABLED && config.NODE_TIME_KEY) {
    console.log("Enabling Nodetime: " + config.NODE_TIME_ENABLED);
    require('nodetime').profile({
        accountKey: config.NODE_TIME_KEY,
        appName: 'yp-backend '+ config.NODE_ENV
    });
}

// Modules
var ypbackendlib = require('ypbackendlib');


// Configure the server
var swaggerServer = ypbackendlib.createSwaggeredServer("HealthCampaignsServer", config);

// initialize Database
var modelNames = require('./models').modelNames;

var schemaNames = ['user']; // schema names to be extended
var modelPath = __dirname + '/models'; // path the schema extensions are located
var schemaExtensions = {};
_.forEach(schemaNames, function (name) {
    schemaExtensions[name] = require(modelPath + '/' + name + '_schema');
});
ypbackendlib.initializeDb(config, modelNames, modelPath, undefined, undefined, schemaExtensions);

// setup our routes
swaggerServer.addRoutes(__dirname + '/routes');


var port = config.port;
swaggerServer.getRestifyServer().listen(port);
console.log('App started on port ' + port + ', now is: ' + new Date());