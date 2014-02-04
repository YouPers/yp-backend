var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

frisby.create('GET all activites')
    .get(URL + '/activities')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        number: String,
        title: String
    })
    .afterJSON(function(activities) {

        // Use data from previous result in next test
        frisby.create('Get single Activity')
            .get(URL + '/activities/' + activities[0].id)
            .expectStatus(200)
            .expectJSON({
                id: String,
                number: String,
                title: String
            })
            .afterJSON(function(activity) {
                activity.defaultexecutiontype = 'group';
                // Use data from previous result in next test
                frisby.create('Put an Update to single Activity')
                    .put(URL + '/activities/' +activity.id, activity)
                    .auth('test_prodadm','yp')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();


