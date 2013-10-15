/**
 * Main server startup and configuration commands
 */

// Load configurations
var env = process.env.NODE_ENV || 'development'
    , config = require('./config/config')[env];


// Modules
var restify = require("restify"),
    mongoose = require('mongoose'),
    preflightEnabler = require('se7ensky-restify-preflight'),
    longjohn = require("longjohn"),
    fs = require("fs");

// Setup Database Connection
var connectStr = config.db_prefix +'://'+config.host+':'+config.db_port+'/'+config.db_database;
console.log(connectStr);
mongoose.connect(connectStr, {server:{auto_reconnect:true}});

// Configure the server
var server = restify.createServer({
    //certificate: ...,
    //key: ...,
    name: 'YP Platform Server',
    version: config.version
});

// setup better error stacktraces
longjohn.async_trace_limit = 5;  // defaults to 10
longjohn.empty_frame = 'ASYNC CALLBACK';

// setup middlewares to be used by server
server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.jsonp());
server.use(restify.gzipResponse());
server.use(restify.bodyParser({ mapParams: false }));

// allows authenticated cross domain requests
preflightEnabler(server);

// Bootstrap models
fs.readdirSync('./models').forEach(function (file) {
    console.log("Loading model " + file);
    require('./models/'+file);
});

// setup our routes
fs.readdirSync('./routes').forEach(function (file) {
    console.log("Loading route: " + file);
    require('./routes/'+file)(server, config);
});



var port = process.env.PORT || config.port;
server.listen(port);
console.log('App started on port ' + port);