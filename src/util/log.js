var bunyan = require('bunyan');
var bsyslog = require('bunyan-syslog');

var config = require('../config/config');

var logConf = config.log;

var loggerOptions = {
    name: "Main",
    streams: logConf.streams || [],
    serializers: bunyan.stdSerializers
};

if (logConf.stdout) {
    loggerOptions.streams.push({
        stream: process.stdout,
        level: logConf.stdout
    });
}

if (logConf.syslog) {
    var mySyslogStream = {
        level: 'debug',
        type: 'raw',
        stream: bsyslog.createBunyanStream({
            type: 'sys',
            facility: logConf.syslog.facility || bsyslog.local0,
            host: logConf.syslog.host,
            port: logConf.syslog.port
        })
    };
    loggerOptions.streams.push(mySyslogStream);
}

if (logConf.stream) {
    loggerOptions.streams.push(logConf.stream);
}

var logger = bunyan.createLogger(loggerOptions);

module.exports = {
    logger: logger
};
