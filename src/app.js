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

server.on('after', function (req, res, route, err) {
    req.log.debug({res: res}, "finished processing request");
    if (err) {
        req.log.info({req: req});
        if (req.body) {
            req.log.info({requestbody: req.body});
        }
        req.log.info({err: err});
    }
});

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

// allows authenticated cross domain requests
preflightEnabler(server);

// setup authentication, currently only HTTP Basic auth over HTTPS is supported
passport.use(new passportHttp.BasicStrategy(auth.validateLocalUsernamePassword));

// setup swagger documentation
swagger.setAppHandler(server);
swagger.setAuthorizationMiddleWare(auth.roleBasedAuth);
swagger.configureSwaggerPaths("", "/api-docs", "");

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