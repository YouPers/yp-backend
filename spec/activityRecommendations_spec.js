var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

// TODO: talk about open questions first: https://youpers.atlassian.net/browse/WL-936

