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