/**
 * Environment dependent configuration properties
 */

var Logger = require('bunyan');

module.exports = {
    development: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'Nodejs Restify Mongoose Demo'
        },
        host: 'localhost',
        port: '8000',
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'test_database',
        session_timeout: 1200000, // defaults to 20 minutes, in ms (20 * 60 * 1000)
        socket_loglevel: '2', // 0 - error, 1 - warn, 2 - info, 3 - debug
        version: '0.1.0',
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    stream: process.stdout,
                    level: 'debug'
                },
                {
                    path: 'logs/server.log',
                    level: 'trace'
                }
            ],
            serializers: {
                req: Logger.stdSerializers.req,
                res: Logger.stdSerializers.res
            }
        }
    }, ci: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        db_prefix: 'mongodb',
        db_host: 'ds047968.mongolab.com',
        db_port: '47968',
        db_database: 'heroku_app18686651',
        db_user: 'yp-backend-db-user',
        db_password: 'driveyourhealth',
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    stream: process.stdout,
                    level: 'info'
                },
                {
                    path: 'logs/server.log',
                    level: 'debug'
                }
            ],
            serializers: {
                req: Logger.stdSerializers.req,
                res: Logger.stdSerializers.res
            }
        }
    }, test: {
        root: require('path').normalize(__dirname + '/..'), app: {
            name: 'Nodejs Restify Mongoose Demo'
        }, openUserSignup: false
    }, production: {
        root: require('path').normalize(__dirname + '/..'), app: {
            name: 'Nodejs Restify Mongoose Demo'
        }, openUserSignup: false
    }
};





