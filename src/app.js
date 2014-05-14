/**
 * Main server startup and configuration commands
 */

// Load configurations
console.log("NODE_ENV:" + process.env.NODE_ENV);

var env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env];

// Modules
var restify = require("restify"),
    preflightEnabler = require('./util/corspreflight'),
    longjohn = require("longjohn"),
    fs = require("fs"),
    Logger = require('bunyan'),
    passport = require('passport'),
    passportHttp = require('passport-http'),
    swagger = require("swagger-node-restify"),
    auth = require('./util/auth'),
    ypi18n = require('./util/ypi18n'),
    error = require('./util/error'),
    db = require('./util/database');

// Configure the server
var server = restify.createServer({
    name: 'YP Platform Server',
    version: config.version,
    log: new Logger(config.loggerOptions)
});

// initialize Database
db.initialize(config.loadTestData);

// setting logging of request and response
// setup better error stacktraces

server.pre(function (request, response, next) {
    request.log.debug({req: request}, 'start processing request');
    return next();
});


process.on('uncaughtException', function(err){
    console.error('Caught uncaught Exception: ' + err );
    process.exit(8);
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
server.use(function(req,res, next) {
    res.header('Expires','-1');
    return next();
});

// allows authenticated cross domain requests
preflightEnabler(server);

// setup authentication, currently only HTTP Basic auth over HTTPS is supported
passport.use(new passportHttp.BasicStrategy(auth.validateLocalUsernamePassword));

// setup swagger documentation
swagger.setAppHandler(server);
swagger.setAuthorizationMiddleWare(auth.roleBasedAuth);
swagger.configureSwaggerPaths("", "/api-docs", "");

swagger.setErrorHandler(function (req, res, err) {
    req.log.error(err);
    console.error('Caught uncaught Exception: ' + err );
    res.send(new error.InternalError(err, err.message || 'unexpected error'));
    return (true);
});

// TODO: (RBLU) remove this when all routes have been properly documented
// setup our (still undocumented) routes
fs.readdirSync('./src/routes').forEach(function (file) {
    if (file.indexOf('_route.js') !== -1) {
        console.log("Loading route: " + file);
        require('./routes/' + file)(server, config);
    }
});

// setup our (properly documented) routes
fs.readdirSync('./src/routes').forEach(function (file) {
    if (file.indexOf('_routesw.js') !== -1) {
        console.log("Loading route: " + file);
        require('./routes/' + file)(swagger, config);
    }
});
swagger.configure(config.backendUrl, "0.1");


var port = process.env.PORT || config.port;
server.listen(port);
console.log('App started on port ' + port);