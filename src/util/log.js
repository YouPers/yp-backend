var bunyan = require('bunyan');
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
var logger = bunyan.createLogger(loggerOptions);

module.exports = {
    logger: logger
};
