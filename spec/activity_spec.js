var frisby = require('frisby');
require('../app.js');
var port = process.env.PORT || 3000;
var URL = 'http://localhost:'+ port +'/api/v1/';

frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { 'X-Auth-Token': 'fa8426a0-8eaf-4d22-8e13-7c1b16a9370c' }
    }
});

frisby.create('GET all activites')
    .get(URL + 'activities')
    .expectStatus(200)
    .expectJSON('*', {
        _id: String,
        number: String,
        title: String
    })
    // 'afterJSON' automatically parses response body as JSON and passes it as an argument
    .afterJSON(function(activities) {

        // Use data from previous result in next test
        frisby.create('Get single Activity')
            .get(URL + '/activities/' + activities[0]._id)
            .expectStatus(200)
            .expectJSON({
                _id: String,
                number: String,
                title: String
            })
            .toss();
    })
    .toss();