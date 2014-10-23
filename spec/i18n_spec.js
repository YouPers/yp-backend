/**
 * Created by retoblunschi on 29.01.14.
 */
var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');
frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { },
        json: true
    }
});

frisby.create('i18n: GET all ideas, no language given, check default')
    .get(URL + '/ideas')
    .expectStatus(200)
    .expectJSONTypes('*', {
        id: String,
        title: String
    })
    .expectHeader('yp-language', 'de')
    .afterJSON(function (ideas) {

        // Use data from previous result in next test
        frisby.create('i18n: Get one idea, no language given, check default')
            .get(URL + '/ideas/' + ideas[0].id)
            .expectStatus(200)
            .expectJSONTypes({
                id: String,
                title: String
            })
            .expectHeader('yp-language', 'de')
            .afterJSON(function (idea) {
                var initialTitleDe = idea.title;
                var newTitleDe = idea.title + "NeuerNameDe";

                frisby.create('i18n: Put an Update to simple i18nString, defaultLanguage')
                    .put(URL + '/ideas/' + idea.id, {title: newTitleDe})
                    .auth('stefan', 'stefan')
                    .expectStatus(200)
                    .expectHeader('yp-language', 'de')
                    .expectJSON({
                        title: newTitleDe
                    })
                    .afterJSON(function (updatedIdea) {
                        expect(updatedIdea.title).not.toEqual(initialTitleDe);

                        frisby.create('i18n: Get assessment, "en" language given')
                            .get(URL + '/ideas/' + ideas[0].id)
                            .addHeader('yp-language', 'en')
                            .expectStatus(200)
                            .expectJSON({
                                id: String,
                                title: String
                            })
                            .expectHeader('yp-language', 'en')
                            .afterJSON(function (ideaEn) {
                                expect(ideaEn.title).not.toEqual(updatedIdea.title);

                                frisby.create('i18n: Put an Update to i18nString to resetLanguage, defaultLanguage')
                                    .put(URL + '/ideas/' + idea.id, {title: initialTitleDe})
                                    .auth('stefan', 'stefan')
                                    .expectStatus(200)
                                    .expectHeader('yp-language', 'de')
                                    .expectJSON({
                                        title: initialTitleDe
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


