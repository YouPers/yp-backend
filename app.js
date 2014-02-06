/**
 * Main server startup and configuration commands
 */

// Load configurations
console.log("NODE_ENV:" + process.env.NODE_ENV);

var env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env];

// Modules
var restify = require("restify"),
    mongoose = require('mongoose'),
    preflightEnabler = require('./util/corspreflight'),
    longjohn = require("longjohn"),
    fs = require("fs"),
    Logger = require('bunyan'),
    passport = require('passport'),
    passportHttp = require('passport-http'),
    swagger = require("swagger-node-restify"),
    auth = require('./util/auth'),
    socket = require('./util/socket');


// Setup Database Connection
var connectStr = config.db_prefix + '://';
if (config.db_user && config.db_password) {
    connectStr += config.db_user + ':' + config.db_password + '@';
}
connectStr += config.db_host + ':' + config.db_port + '/' + config.db_database;

console.log(connectStr);
mongoose.connect(connectStr, {server: {auto_reconnect: true}});

// Configure the server
var server = restify.createServer({
    name: 'YP Platform Server',
    version: config.version,
    log: new Logger(config.loggerOptions)
});

socket.socketServer(server);

// setung logging of request and response
server.pre(function (request, response, next) {
    request.log.debug({req: request}, 'start processing request');
    return next();
});

server.on('after', function (req, res, route, err) {
    req.log.debug({res: res}, "finished processing request");
    if (err) {
        req.log.info({req: req});
        if (req.body) {
            req.log.info({requestbody: req.body});
        }
        req.log.info({err:err});
    }
});

// setup better error stacktraces
longjohn.async_trace_limit = 10;  // defaults to 10
longjohn.empty_frame = 'ASYNC CALLBACK';

// setup middlewares to be used by server
server.use(restify.requestLogger());
server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.gzipResponse());
server.use(restify.bodyParser({ mapParams: false }));
server.use(passport.initialize());
server.use(restify.fullResponse());

// allows authenticated cross domain requests
preflightEnabler(server);

// Bootstrap models
fs.readdirSync('./models').forEach(function (file) {
    if (file.indexOf('_model.js') !== -1) {
        console.log("Loading model: " + file);
        var model = require('./models/' + file);
        if (model.getSwaggerModel) {
            swagger.addModels(model.getSwaggerModel());
        }
    }
});

// setup authentication, currently only HTTP Basic auth over HTTPS is supported
passport.use(new passportHttp.BasicStrategy(auth.validateLocalUsernamePassword));

// setup swagger documentation
swagger.setAppHandler(server);
swagger.setAuthorizationMiddleWare(auth.roleBasedAuth);
swagger.configureSwaggerPaths("", "/api-docs", "");

// TODO: (RBLU) remove this when all routes have been properly documented
// setup our (still undocumented) routes
fs.readdirSync('./routes').forEach(function (file) {
    if (file.indexOf('_route.js') !== -1) {
        console.log("Loading route: " + file);
        require('./routes/' + file)(server, config);
    }
});

// setup our (properly documented) routes
fs.readdirSync('./routes').forEach(function (file) {
    if (file.indexOf('_routesw.js') !== -1) {
        console.log("Loading route: " + file);
        require('./routes/' + file)(swagger, config);
    }
});
swagger.configure(config.backendUrl, "0.1");


var port = process.env.PORT || config.port;
server.listen(port);
console.log('App started on port ' + port);