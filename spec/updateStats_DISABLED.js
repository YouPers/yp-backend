'use strict';

/**
 * this test is disabled because it is testing the approach to have persisted, constantly updated statistics.
 * I currently think that is a case of http://c2.com/cgi/wiki?PrematureOptimization
 *
 * We currently go down another route (compute statistics on the fly) and optimize when needed.
 */
var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;

var newPlan = {
    "activity": {
        "defaultduration": 30, "defaultexecutiontype": "self", "defaultfrequency": "day", "defaultvisibility": "private", "number": "Act-186", "source": "community", "text": "Die Atmung spielt bei der Stressbewältigung eine zentrale Rolle. Um ruhiger zu werden, sollst du lernen, richtig zu atmen. Mit der Zeit gelingt es, den Herzrhythmus mit der Atmung zu koppeln. Ist die Atmung ruhig und regelmässig, ist auch der Herzryhthmus entsprechend, und die Balance des autonomen Nervensystemes stellt sich ein. Ob du dies durch Meditation, Autogenes Training, Yoga oder leichten Dauerlauf erreichtst, ist nicht so wichtig. Hauptsache ist, du tust es.", "title": "Regeneriere dich täglich 20 Minuten aktiv, indem du mit ruhigem und tiefen Atmen (tief einatmen und ruhig ausatmen) dein Parasympathikus (Anteil des autonomen Nervensystems, der für Regenaration steht) stimulierst", "fields": ["AwarenessAbility", "Breaks", "Relaxation"], "topics": ["workLifeBalance"], "id": "5278c6aecdeab69a250000bd", "version": 0, "route": "activities", "parentResource": null, "restangularCollection": false
    },
    "status": "active", "mainEvent": {
        "allDay": false, "start": "2014-11-22T09:00:00.000Z", "end": "2014-11-22T09:30:00.000Z", "frequency": "day", "recurrence": {
            "end-by": {
                "type": "after", "after": 6
            },
            "every": 1
        }
    },
    "executionType": "self", "visibility": "private",
    "campaign": "527916a82079aa8704000006",
    "fields": ['Relaxation', 'TimeManagement'],
    "topics": ['workLifeBalance']
};

frisby.create('check whether default campaign is available')
    .get(URL + '/campaigns/527916a82079aa8704000006')
    .expectStatus(200)
    .expectJSON({
        id: '527916a82079aa8704000006'
    }).afterJSON(function(campaign) {


        frisby.create('POST new activity Plan for this campaign')
            .post(URL + '/activitiesPlanned', newPlan)
            .expectStatus(201)
            .afterJSON(function(savedPlan) {
                frisby.create('loadCampaign again and see whether stats are updated correctly')
                    .get(URL + '/campaigns/527916a82079aa8704000006')
                    .expectStatus(200)
                    .afterJSON(function(updatedCampaign) {
                        expect(updatedCampaign.stats).toBeDefined();
                        expect(updatedCampaign.stats.activities.actsPlanned.total).toEqual(campaign.stats.activities.actsPlanned.total + 1);
                        expect(updatedCampaign.stats.activities.eventsPlanned.total).toEqual(campaign.stats.activities.eventsPlanned.total + 6);
                        expect(updatedCampaign.stats.activities.actsPlanned.byActivityId[newPlan.activity.id]).toBeDefined();

                        var updatedEvent = savedPlan.events[0];
                        updatedEvent.status = 'done';
                        updatedEvent.feedback = 4;


                        frisby.create('Update Activity Event in this Plan, Event Done')
                            .put(URL + '/activitiesPlanned/' + savedPlan.id + '/events/' + savedPlan.events[0].id, updatedEvent)
                            .expectStatus(200)
                            .afterJSON(function(updatedEvent) {
                                frisby.create('loadCampaign again and see whether stats are updated correctly')
                                    .get(URL + '/campaigns/527916a82079aa8704000006')
                                    .expectStatus(200)
                                    .afterJSON(function(updatedCampaign) {
                                        expect(updatedCampaign.stats).toBeDefined();
                                        expect(updatedCampaign.stats.activities.actsPlanned.total).toEqual(campaign.stats.activities.actsPlanned.total + 1);
                                        expect(updatedCampaign.stats.activities.eventsPlanned.total).toEqual(campaign.stats.activities.eventsPlanned.total + 6);
                                        expect(updatedCampaign.stats.activities.eventsDone.total).toEqual(campaign.stats.activities.eventsDone.total + 1);

                                        updatedEvent.status = 'missed';

                                        frisby.create('Update Activity Event in this Plan, Event Done --> Event missed')
                                            .put(URL + '/activitiesPlanned/' + savedPlan.id + '/events/' + savedPlan.events[0].id, updatedEvent)
                                            .expectStatus(200)
                                            .afterJSON(function(updatedEvent) {
                                                frisby.create('loadCampaign again and see whether stats are updated correctly')
                                                    .get(URL + '/campaigns/527916a82079aa8704000006')
                                                    .expectStatus(200)
                                                    .afterJSON(function(updatedCampaign) {
                                                        expect(updatedCampaign.stats).toBeDefined();
                                                        expect(updatedCampaign.stats.activities.actsPlanned.total).toEqual(campaign.stats.activities.actsPlanned.total + 1);
                                                        expect(updatedCampaign.stats.activities.eventsPlanned.total).toEqual(campaign.stats.activities.eventsPlanned.total + 6);
                                                        expect(updatedCampaign.stats.activities.eventsDone.total).toEqual(campaign.stats.activities.eventsDone.total);
                                                        expect(updatedCampaign.stats.activities.eventsMissed.total).toEqual(campaign.stats.activities.eventsMissed.total + 1);
                                                    })
                                                    .toss();
                                            })
                                            .toss();
                                    })
                                    .toss();
                            })
                            .toss();
                    })
                    .toss();
            })
            .toss();
    })
    .toss();













