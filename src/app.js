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


var captain = require('captainup');

captain.up({
    // Your API Key
    api_key: '5579995ae6808babbc0000c8',
    // Your API Secret
    api_secret: '719641e2e34cc06fb1dc06efc732cfc91830341ec32dbd62099a410cf928857d'
});



// Configure the server
var swaggerServer = ypbackendlib.createSwaggeredServer("HealthCampaignsServer", config);

require('./util/database').initializeDb();

// initialize stats
require('./stats/statsQueries');

swaggerServer.getRestifyServer().on('after',function(req, res) {
    console.log("method: " + req.method);
    var path =  req.route && req.route.path;
    console.log("route path: " + path);

    if (req.method === 'POST' && path === "/login") {
        captain.request({
            url: "/app/"+"5579995ae6808babbc0000c8" + "/players",
            method: "POST",
            params: {
                app: "5579995ae6808babbc0000c8",
                secret: '719641e2e34cc06fb1dc06efc732cfc91830341ec32dbd62099a410cf928857d',
                user: {
                    id: req.user.id,
                    name: req.user.fullname
                }
            }})
            .then(function(result) {
            console.log("CapatainUp: result "+ JSON.stringify(result));
        }, function(err) {
                console.log("error in captainup: " + JSON.stringify(err));
            });
        console.log("users id on login: " + req.user.id);
    } else {
        captain.actions.create({user: "2226143731434315162201849148",
            action: {
                name: req.method +":"+ (req.route && req.route.path),
                entity: {
                    type: "backend"
                }
        }}).then(function(res) {
            req.log.debug({type: "captainup", result: res});
        }, function(error) {
            req.log.error({type: "captainup", err: error});
        });
    }
});


// setup our routes
swaggerServer.addRoutes(__dirname + '/routes');




var port = config.port;
swaggerServer.getRestifyServer().listen(port);
console.log('App started on port ' + port + ', now is: ' + new Date());



captain.request({url: "/status"}).then(function(res) {
    console.log("result: " + JSON.stringify(res));
});
