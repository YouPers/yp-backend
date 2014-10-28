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

        frisby.create('IdeaCtx: plan an event first')
            .post(URL + '/events', {
                "owner": user.id,
                "idea": consts.groupIdea.id,
                "title": "myTitle",
                "visibility": "public",
                "campaign": campaign.id,
                "executionType": "group",
                "start": moment().add(1, 'days'),
                "end": moment().add(1, 'days').add(2, 'hours'),
                "allDay": false,
                "frequency": "once",
                "status": "active"
            })
            .auth(user.username, 'yp')
            .expectStatus(201)
            .afterJSON(function (newEvent) {
                frisby.create('IdeaCtx: post a message')
                    .post(URL + '/messages', {

                        targetSpaces: [
                            {
                                type: 'event',
                                targetId: newEvent.id
                            }
                        ],

                        author: user.id,
                        publishFrom: moment(),
                        publishTo: moment().add(1, 'hours'),

                        refDocs: [
                            { docId: consts.groupIdea.id, model: 'Idea'},
                            { docId: newEvent.id, model: 'Event'}
                        ],
                        idea: consts.aloneIdea.id
                    })
                    .auth(user.username, 'yp')
                    .expectStatus(201)
                    .afterJSON(function (ctx) {
                        frisby.create('IdeaCtx: getCtx, assert event, events and message are in there')
                            .get(URL + '/ideas/' + consts.groupIdea.id + '/usercontext')
                            .auth(user.username, 'yp')
                            .expectStatus(200)
                            .afterJSON(function (ctx) {
                                expect(ctx.events.length).toEqual(1);
                                expect(ctx.events[0].id).toEqual(newEvent.id);
                                expect(ctx.occurences).toBeDefined();
                                expect(ctx.occurences.length).toEqual(1);
                                expect(ctx.socialInteractions).toBeDefined();
                                expect(ctx.socialInteractions.Message).toBeDefined();
                                expect(ctx.socialInteractions.Message.length).toEqual(1);
                                expect(ctx.socialInteractions.Message[0].refDocs.length).toEqual(2);
                                frisby.create('IdeaCtx: delete Event')
                                    .delete(URL + '/events/' + newEvent.id)
                                    .auth(user.username, 'yp')
                                    .expectStatus(200)
                                    .toss();
                                return cleanupFn();
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
                publishTo: moment().add(1, 'hours'),

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
                        expect(ctx.events.length).toEqual(0);
                        expect(ctx.socialInteractions).toBeDefined();
                        expect(ctx.socialInteractions.Recommendation).toBeDefined();
                        expect(ctx.socialInteractions.Recommendation.length).toEqual(1);
                        expect(ctx.socialInteractions.Recommendation[0].idea).toEqual(consts.aloneIdea.id);
                        frisby.create('IdeaCtx: delete Recommendation')
                            .delete(URL + '/recommendations/' + newRec.id)
                            .auth('test_campaignlead', 'yp')
                            .expectStatus(200)
                            .toss();
                        return cleanupFn();
                    })
                    .toss();
            })
            .toss();
    });

