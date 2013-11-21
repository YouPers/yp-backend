var events = require('events'),
    mongoose = require('mongoose'),
    util = require('util');


var statsUpdaterInstance = new events.EventEmitter();
module.exports = statsUpdaterInstance;