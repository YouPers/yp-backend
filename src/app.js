/**
 * Main server startup and configuration commands
 */

// Load configuration
var config = require('./config/config');

if (config.NEW_RELIC_ENABLED === "enabled") {
    console.log("Enabling new relic: " + config.NEW_RELIC_ENABLED);
    require('newrelic');
}

if (config.NODE_TIME_ENABLED === "enabled" && config.NODE_TIME_KEY) {
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

require('./util/database').initializeDb();

// initialize stats
require('./stats/statsQueries');

// setup our routes
swaggerServer.addRoutes(__dirname + '/routes');


var port = config.port;
swaggerServer.getRestifyServer().listen(port);
console.log('App started on port ' + port + ', now is: ' + new Date());