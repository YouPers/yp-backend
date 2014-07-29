var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');
var moment = require('moment');


frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        json: true,
        headers: {}
    }
});

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('IdeaCtx: plan an activity first')
            .post(URL + '/activities', {
                "owner": user.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "mainEvent": {
                    "start": moment().add('days', 1),
                    "end": moment().add('days', 1).add('hours', 2),
                    "allDay": false,
                    "frequency": "once"
                },
                "status": "active"
            })
            .auth(user.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (newActivity) {
                frisby.create('IdeaCtx: post a message')
                    .post(URL + '/messages', {

                        targetSpaces: [
                            {
                                type: 'activity',
                                targetId: newActivity.id
                            }
                        ],

                        author: user.id,
                        publishFrom: moment(),
                        publishTo: moment().add('hours', 1),

                        refDocs: [
                            { docId: consts.aloneIdea.id, model: 'Idea'},
                            { docId: newActivity.id, model: 'Activity'}
                        ],
                        idea: consts.aloneIdea.id
                    })
                    .auth(user.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (ctx) {
                        frisby.create('IdeaCtx: getCtx, assert activity, events and message are in there')
                            .get(URL + '/ideas/' + consts.groupIdea.id + '/usercontext')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (ctx) {
                                expect(ctx.activities.length).toEqual(1);
                                expect(ctx.activities[0].id).toEqual(newActivity.id);
                                expect(ctx.events).toBeDefined();
                                expect(ctx.events.length).toEqual(1);
                                expect(ctx.socialInteractions).toBeDefined();
                                expect(ctx.socialInteractions.Message).toBeDefined();
                                expect(ctx.socialInteractions.Message.length).toEqual(1);
                                expect(ctx.socialInteractions.Message[0].refDocs.length).toEqual(2);
                                frisby.create('IdeaCtx: delete Activity')
                                    .delete(URL + '/activities/' + newActivity.id)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .toss();
                            })
                            .toss();
                    })
                    .toss();
            })
            .toss();
    });

consts.newUserInNewCampaignApi(
    function (err, user, campaign, cleanupFn) {
        if (err) {
            expect(err).toBeNull();
        }

        frisby.create('IdeaCtx: post a recommendation')
            .post(URL + '/recommendations', {

                targetSpaces: [
                    {
                        type: 'campaign',
                        targetId: campaign.id
                    }
                ],

                author: consts.users.test_campaignlead.id,
                publishFrom: moment(),
                publishTo: moment().add('hours', 1),

                refDocs: [
                    { docId: consts.aloneIdea.id, model: 'Idea'}
                ],
                idea: consts.aloneIdea.id
            })
            .auth('test_campaignlead', 'yp')
            .expectStatus(201)
            .afterJSON(function (newRec) {
                frisby.create('IdeaCtx: getCtx, assert recommendation is in there')
                    .get(URL + '/ideas/' + consts.aloneIdea.id + '/usercontext')
                    .auth(user.username, 'yp')
                    .expectStatus(200)
                    .afterJSON(function (ctx) {
                        expect(ctx.activities.length).toEqual(0);
                        expect(ctx.socialInteractions).toBeDefined();
                        expect(ctx.socialInteractions.Recommendation).toBeDefined();
                        expect(ctx.socialInteractions.Recommendation.length).toEqual(1);
                        expect(ctx.socialInteractions.Recommendation[0].idea).toEqual(consts.aloneIdea.id);
                        frisby.create('IdeaCtx: delete Recommendation')
                            .delete(URL + '/recommendations/' + newRec.id)
                            .auth('test_campaignlead', 'yp')
                            .expectStatus(200)
                            .toss();
                    })
                    .toss();
            })
            .toss();
    });

