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
        }
    },
    cimaster: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        webclientUrl: "https://cimaster.youpers.com",
        backendUrl: "https://cimaster.youpers.com/api",
        host: "cimaster.youpers.com",
        port: '8000',
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'test_database',
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
        }
    },
    uat: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        port: '8000',
        webclientUrl: "https://uat.youpers.com",
        backendUrl: "https://uat.youpers.com/api",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
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
        }
    },
    prod: {
        root: require('path').normalize(__dirname + '/..'),
        app: {
            name: 'YouPers Platform Server'
        },
        port: '8000',
        webclientUrl: "https://prod.youpers.com",
        backendUrl: "https://prod.youpers.com/api",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'ypdb',
        db_user: 'nodeDbAccess',
        db_password: 'yp13%mongodb%prod',
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
            key: "50126a4a500219238cd678a383cdsdfsdfdsfsdfe42",
            algorithm: "aes256",
            maxTokenLifetime: 10 * 60 * 1000
        }
    }

};





