/**
 * Environment dependent configuration properties
 */

var nconf = require('nconf');
var env = process.env.NODE_ENV || 'development';
console.log("NODE_ENV:" + process.env.NODE_ENV + ", using env: " + env);

//
// 1. any overrides
//
nconf.overrides({});

//
// 2. `process.env`
// 3. `process.argv`
//
nconf.env().argv();

//
// 4. Values in `config/[env].json`
//
nconf.file('envspecific_'+env, require('path').normalize(__dirname + '/'+ env + '.json'));
console.log('reading config from: ' + require('path').normalize(__dirname + '/'+ env + '.json'));

//
// 5. Values in `config/defaults.json`
//
nconf.file('defaultfile',require('path').normalize(__dirname + '/defaults.json'));
console.log('reading config from: ' + require('path').normalize(__dirname + '/defaults.json'));

//
// 6. hardcoded defaults:
nconf.defaults({});

module.exports = nconf.get();

/**
    things not yet moved to ansible

    cimaster: {
        webclientUrl: "https://cimaster.youpers.com",
        backendUrl: "https://cimaster.youpers.com/api",
        host: "cimaster.youpers.com",
        log: {
            streams: [
                {
                    path: '/var/log/yp-backend/server.log',
                    level: 'info'
                }
            ]        }
    },
    uat: {
        webclientUrl: "https://uat.youpers.com",
        backendUrl: "https://uat.youpers.com/api",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'ypdb',
        db_user: 'nodeDbAccess',
        db_password: 'yp13%mongodb%uat',
        log: {
            streams: [
                {
                    path: '/var/log/yp-backend/server.log',
                    level: 'info'
                }
            ]
        },
    },
    prod: {
        port: '8000',
        webclientUrl: "https://prod.youpers.com",
        backendUrl: "https://prod.youpers.com/api",
        db_prefix: 'mongodb',
        db_host: 'localhost',
        db_port: '27017',
        db_database: 'ypdb',
        db_user: 'nodeDbAccess',
        db_password: 'yp13%mongodb%prod',
        loggerOptions: {
            streams: [
                {
                    path: '/var/log/yp-backend/server.log',
                    level: 'info'
                }
            ]
        },
        linkTokenEncryption : {
            key: "50126a4a500219238cd678a383cdsdfsdfdsfsdprod"
        }
    }

};
*/




