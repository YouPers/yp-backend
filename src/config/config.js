/**
 * Environment dependent configuration properties
 */

var bunyan = require('bunyan');

module.exports = {
    development: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'Nodejs Restify Mongoose Demo'
        },
        host: 'localhost',
        port: '8000',
        webclientUrl: "http://localhost:9000",
        backendUrl: "http://localhost:8000",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'test_database',
        session_timeout: 1200000, // defaults to 20 minutes, in ms (20 * 60 * 1000)
        socket_loglevel: '2', // 0 - error, 1 - warn, 2 - info, 3 - debug
        version: '0.1.0',
        loadTestData: true,
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
            serializers: bunyan.stdSerializers
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdab197ed5fe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        },
        paymentCodeTokenEncryption : {
            key: "b12054d4e709c7598e3e8b0d521902e59cd74b41",
            algorithm: "des"
        }
    },
    test: {   // used by CircleCI!!!
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        host: 'localhost',
        port: '8000',
        webclientUrl: "http://localhost:9000",
        backendUrl: "http://localhost:8000",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'test_database',
        loadTestData: true,
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    path: 'logs/server.log',
                    level: 'info'
                }
            ],
            serializers: bunyan.stdSerializers
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdab197ed5fe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        },
        paymentCodeTokenEncryption : {
            key: "b12054d4e709c7598e3e8b0d521902e59cd74b41",
            algorithm: "des"
        }
    },
    ci: {   // used by Heroku yp-backend-ci
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        webclientUrl: "http://yp-ewl-webclient-ci.herokuapp.com",
        backendUrl: "http://yp-backend-ci.herokuapp.com",
        host: "yp-backend-ci.herokuapp.com",
        port: '8000',
        db_prefix: 'mongodb',
        db_host: 'ds047968.mongolab.com',
        db_port: '47968',
        db_database: 'heroku_app18686651',
        db_user: 'yp-backend-db-user',
        db_password: 'driveyourhealth',
        loadTestData: true,
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    path: 'logs/server.log',
                    level: 'info'
                }
            ],
            serializers: bunyan.stdSerializers
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdab197ed5fe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        }
    },
    herokutest: {   // used by Heroku yp-backend-test
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        webclientUrl: "http://yp-ewl-backend-test.herokuapp.com",
        backendUrl: "http://yp-backend-test.herokuapp.com",
        port: '8000',
        db_prefix: 'mongodb',
        db_host: 'ds051658.mongolab.com',
        db_port: '51658',
        db_database: 'heroku_app18686715',
        db_user: 'yp-backend-db-user',
        db_password: 'driveyourhealth',
        loadTestData: true,
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    path: 'logs/server.log',
                    level: 'info'
                }
            ],
            serializers: bunyan.stdSerializers
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdab197ed5fe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        }
    },
    uat: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        port: '8000',
        webclientUrl: "https://uat.youpers.com",
        backendUrl: "https://uat.youpers.com",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '51111',
        db_database: 'ypdb',
        db_user: 'nodeDbAccess',
        db_password: 'yp13%mongodb%uat',
        loadTestData: true,
        loggerOptions: {
            name: 'Main',
            streams: [
                {
                    path: '/var/log/yp-backend/server.log',
                    level: 'info'
                }
            ],
            serializers: bunyan.stdSerializers
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdab197ed5fe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        },
        paymentCodeTokenEncryption : {
            key: "b12054d4e709c7598e3e8b0d521902e59cd74b41",
            algorithm: "des"
        }
    },
    production: {
        root: require('path').normalize(__dirname + '/..'), app: {
            name: 'Nodejs Restify Mongoose Demo'
        },
        loadTestData: false
    }
};





