var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json:true,
        headers: {}
    }
});

frisby.create('Activity: post a new activity as a prodadm')
    .post(URL + '/activities', {
        "title": "Test Activity",
        "text": "New Test Activity Text",
        "number": "UnitTest"
    })
    .auth('test_prodadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newActivity) {

        expect(newActivity.number).toEqual("UnitTest");

        frisby.create('Activity: delete the created prodadm activity again')
            .delete(URL + '/activities/' + newActivity.id)
            .auth('test_prodadm', 'yp')
            .expectStatus(200)

            .toss();

    })
    .toss();

frisby.create('Activity: post a new activity as a campaign lead without a valid campaign id')
    .post(URL + '/activities', {
        "title": "Test Campaign Activity",
        "text": "New Test Campaign Activity Text",
        "number": "UnitTest"
    })
    .auth('test_campaignlead', 'yp')
    .expectStatus(409)

    .toss();

frisby.create('Activity: post a new activity as a campaign lead of another campaign')
    .post(URL + '/activities', {
        "title": "Test Campaign Activity for wrong campaign",
        "text": "New Test Campaign Activity Text",
        "campaign": "527916a82079aa8704000006",
        "number": "UnitTest"
    })
    .auth('test_campaignlead2', 'yp')
    .expectStatus(403)

    .toss();

frisby.create('Activity: post a new activity as a campaign lead with a valid campaign id')
    .post(URL + '/activities', {
        "title": "Test Campaign Activity",
        "text": "New Test Campaign Activity Text",
        "campaign": "527916a82079aa8704000006",
        "number": "UnitTest"
    })
    .auth('test_campaignlead', 'yp')
    .expectStatus(201)
    .afterJSON(function (newActivity) {

        expect(newActivity.number).toEqual("UnitTest");
        expect(newActivity.source).toEqual("campaign");

        frisby.create('Activity: delete the created campaign lead activity again')
            .delete(URL + '/activities/' + newActivity.id)
            .auth('test_sysadm', 'yp')
            .expectStatus(200)

            .toss();

    })
    .toss();

frisby.create('Activity: GET all activites')
    .get(URL + '/activities')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        number: String,
        title: String
    })
    .afterJSON(function(activities) {

        // Use data from previous result in next test
        frisby.create('Activity: Get single Activity')
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
                frisby.create('Activity: Put an Update to single Activity')
                    .put(URL + '/activities/' +activity.id, activity)
                    .auth('test_prodadm','yp')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();



