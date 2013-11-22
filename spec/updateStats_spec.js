'use strict';

var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port + '/api/v1/';


frisby.create('check whether default campaign is available')
    .get(URL + 'campaigns/527916a82079aa8704000006')
    .expectStatus(200)
    .expectJSON({
        id: '527916a82079aa8704000006'
    })
    .toss();



var newPlan = {
    "activity": {
        "defaultduration": 30, "defaultexecutiontype": "self", "defaultfrequency": "day", "defaultvisibility": "private", "number": "Act-186", "source": "community", "text": "Die Atmung spielt bei der Stressbewältigung eine zentrale Rolle. Um ruhiger zu werden, sollst du lernen, richtig zu atmen. Mit der Zeit gelingt es, den Herzrhythmus mit der Atmung zu koppeln. Ist die Atmung ruhig und regelmässig, ist auch der Herzryhthmus entsprechend, und die Balance des autonomen Nervensystemes stellt sich ein. Ob du dies durch Meditation, Autogenes Training, Yoga oder leichten Dauerlauf erreichtst, ist nicht so wichtig. Hauptsache ist, du tust es.", "title": "Regeneriere dich täglich 20 Minuten aktiv, indem du mit ruhigem und tiefen Atmen (tief einatmen und ruhig ausatmen) dein Parasympathikus (Anteil des autonomen Nervensystems, der für Regenaration steht) stimulierst", "fields": ["AwarenessAbility", "Breaks", "Relaxation"], "topics": ["workLifeBalance"], "id": "5278c6aecdeab69a250000bd", "version": 0, "route": "activities", "parentResource": null, "restangularCollection": false
    },
    "status": "active", "mainEvent": {
        "allDay": false, "start": "2013-11-22T09:00:00.000Z", "end": "2013-11-22T09:30:00.000Z", "frequency": "day", "recurrence": {
            "end-by": {
                "type": "after", "after": 6
            },
            "every": 1
        }
    },
    "executionType": "self", "visibility": "private",
    "campaign": "527916a82079aa8704000006"
};


frisby.create('POST new activity Plan for this campaign')
    .post(URL + 'activitiesPlanned', newPlan)
    .expectStatus(201)
    .afterJSON(function(savedPlan) {
        frisby.create('loadCampaign again and see whether stats are updated correctly')
            .get(URL + 'campaigns/527916a82079aa8704000006')
            .expectStatus(200)
            .afterJSON(function(updatedCampaign) {
                //expect(updatedCampaign.stats).toBeDefined();
            })
            .toss();
    })
    .toss();




