/**
 * Main server startup and configuration commands
 */

// Load configurations
var env = process.env.NODE_ENV || 'development',
    config = require('./config/config')[env];


// Modules
var restify = require("restify"),
    mongoose = require('mongoose'),
    preflightEnabler = require('se7ensky-restify-preflight'),
    longjohn = require("longjohn"),
    fs = require("fs"),
    Logger = require('bunyan'),
    passport = require('passport'),
    passportHttp = require('passport-http');

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
    //certificate: ...,
    //key: ...,
    name: 'YP Platform Server',
    version: config.version,
    log: new Logger(config.loggerOptions)
});

// setung logging of request and response
server.pre(function (request, response, next) {
    request.log.info({req: request}, 'start');        // (1)
    return next();
});

server.on('after', function (req, res, route) {
    req.log.info({res: res}, "finished");             // (3)
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
server.use(passport.initialize());

// allows authenticated cross domain requests
preflightEnabler(server);

// Bootstrap models
fs.readdirSync('./models').forEach(function (file) {
    if (file.indexOf('_model.js') !== -1) {
        console.log("Loading model: " + file);
        require('./models/' + file);
    }
});

// setup our routes
fs.readdirSync('./routes').forEach(function (file) {
    if (file.indexOf('_route.js') !== -1) {
        console.log("Loading route: " + file);
        require('./routes/' + file)(server, config);
    }
});


// setup authentication
var User = mongoose.model('User');
passport.use(new passportHttp.BasicStrategy(
    function(username, password, done) {
        User.findOne({ username: username }, function (err, user) {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            if (!user.validPassword(password)) { return done(null, false); }
            return done(null, user);
        });
    }
));


var port = process.env.PORT || config.port;
server.listen(port);
console.log('App started on port ' + port);