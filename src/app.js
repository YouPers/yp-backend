/**
 * Main server startup and configuration commands
 */

// Load configuration
var config = require('./config/config');

if (config.NEW_RELIC_ENABLED === "enabled") {
    console.log("Enabling new relic: " + config.NEW_RELIC_ENABLED);
    require('newrelic');
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