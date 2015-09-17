var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:'+ port;
var consts = require('./testconsts');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: {}
    }
});

frisby.create('Idea: post a new idea as a prodadm')
    .post(URL + '/ideas', {
        "title": "Test Idea",
        "text": "New Test Idea Text",
        "number": "UnitTest"
    })
    .auth('test_prodadm', 'yp')
    .expectStatus(201)
    .afterJSON(function (newIdea) {

        expect(newIdea.number).toEqual("UnitTest");

        frisby.create('Idea: delete the created prodadm idea again')
            .delete(URL + '/ideas/' + newIdea.id)
            .auth('test_prodadm', 'yp')
            .expectStatus(200)

            .toss();

    })
    .toss();

frisby.create('Idea: post a new idea as a campaign lead without a valid campaign id')
    .post(URL + '/ideas', {
        "title": "Test Campaign Idea",
        "text": "New Test Campaign Idea Text",
        "number": "UnitTest"
    })
    .auth('test_campaignlead', 'yp')
    .expectStatus(409)

    .toss();

frisby.create('Idea: post a new idea as a campaign lead of another campaign')
    .post(URL + '/ideas', {
        "title": "Test Campaign Idea for wrong campaign",
        "text": "New Test Campaign Idea Text",
        "campaign": "527916a82079aa8704000006",
        "number": "UnitTest"
    })
    .auth('test_campaignlead2', 'yp')
    .expectStatus(403)

    .toss();

consts.newUserInNewCampaignApi(function(err, user, campaign, cleanupFn) {
    frisby.create('Idea: post a new idea as a campaign lead with a valid campaign id')
        .post(URL + '/ideas', {
            "title": "Test Campaign Idea",
            "text": "New Test Campaign Idea Text",
            "campaign": campaign.id,
            "number": "UnitTest"
        })
        .auth(user.username, 'yp')
        .expectStatus(201)
        .afterJSON(function (newIdea) {

            expect(newIdea.number).toEqual("UnitTest");
            expect(newIdea.source).toEqual("campaign");
            cleanupFn();

            frisby.create('Idea: delete the created campaign lead idea again')
                .delete(URL + '/ideas/' + newIdea.id)
                .auth('test_sysadm', 'yp')
                .expectStatus(200)

                .toss();

        })
        .toss();

});

frisby.create('Idea: GET all activites')
    .get(URL + '/ideas')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        number: String,
        title: String
    })
    .afterJSON(function(ideas) {

        // Use data from previous result in next test
        frisby.create('Idea: Get single Idea')
            .get(URL + '/ideas/' + ideas[3].id)
            .expectStatus(200)
            .expectJSON({
                id: String,
                number: String,
                title: String
            })
            .afterJSON(function(idea) {
                idea.defaultexecutiontype = 'group';
                // Use data from previous result in next test
                frisby.create('Idea: Put an Update to single Idea')
                    .put(URL + '/ideas/' +idea.id, idea)
                    .auth('test_prodadm','yp')
                    .expectStatus(200)
                    .toss();
            })
            .toss();
    })
    .toss();



