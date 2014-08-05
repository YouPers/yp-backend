/**
 * Main server startup and configuration commands
 */

// Load configuration
var config = require('./config/config');

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
var restify = require("restify"),
    preflightEnabler = require('./util/corspreflight'),
    longjohn = require("longjohn"),
    fs = require("fs"),
    logger = require('./util/log').logger,
    passport = require('passport'),
    swagger = require("swagger-node-restify"),
    auth = require('./util/auth'),
    ypi18n = require('./util/ypi18n'),
    error = require('./util/error'),
    db = require('./util/database');


// Configure the server
var server = restify.createServer({
    name: 'YP Platform Server',
    version: config.version,
    log: logger
});

// initialize Database
db.initialize();

// setting logging of request and response
// setup better error stacktraces

server.pre(function (request, response, next) {
    request.log.debug({req: request}, 'start processing request');
    return next();
});


process.on('uncaughtException', function (err) {
    console.error('Caught uncaught process Exception: ' + err);
    process.exit(8);
});

server.on('uncaughtException', function (req, res, route, err) {
    req.log.error(err);
    console.error('Caught uncaught server Exception: ' + err);
    res.send(new error.InternalError(err, err.message || 'unexpected error'));
    return (true);
});

server.on('after', function (req, res, route, err) {
    req.log.debug({res: res}, "finished processing request");
    if (err && !err.doNotLog) {
        req.log.info({req: req});
        if (req.body) {
            req.log.info({requestbody: req.body});
        }
        req.log.info({err: err});
    }
});

// setup better error stacktraces
longjohn.async_trace_limit = 10;  // defaults to 10
longjohn.empty_frame = 'ASYNC CALLBACK';

// initialize i18n
var i18n = ypi18n.initialize();

// setup middlewares to be used by server
server.use(restify.requestLogger());
server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.gzipResponse());
server.use(restify.bodyParser({ mapParams: false }));
server.use(ypi18n.angularTranslateI18nextAdapterPre);
server.use(i18n.handle);
server.use(ypi18n.angularTranslateI18nextAdapterPost);
server.use(passport.initialize());
server.use(restify.fullResponse());

// prevents browsers from caching our responses. Without this header IE caches
// XHR-responses and signals 304 to our app without forwarding the request to the backend.
server.use(function (req, res, next) {
    res.header('Expires', '-1');
    return next();
});

// allows authenticated cross domain requests
preflightEnabler(server);

auth.setupPassport(passport);

// setup swagger documentation
swagger.setAppHandler(server);
swagger.setAuthorizationMiddleWare(auth.roleBasedAuth);
swagger.configureSwaggerPaths("", "/api-docs", "");

swagger.setErrorHandler(function (req, res, err) {
    req.log.error(err);
    console.error('Caught uncaught Exception in Swagger: ' + err + ' message: ' + err.message);
    res.send(new error.InternalError(err, err.message || 'unexpected error'));
    return (true);
});

// setup our routes
fs.readdirSync('./src/routes').forEach(function (file) {
    if (file.indexOf('_route.js') !== -1) {
        console.log("Initializing route: " + file);
        require('./routes/' + file)(swagger);
    }
});
swagger.configure(config.backendUrl, "0.1");


var port = config.port;
server.listen(port);
console.log('App started on port ' + port + ', now is: ' + new Date());