/**
 * Created by retoblunschi on 29.01.14.
 */
var frisby = require('frisby');
var port = process.env.PORT || 8000;
var URL = 'http://localhost:' + port;
var consts = require('./testconsts');
frisby.globalSetup({ // globalSetup is for ALL requests
    request: {
        headers: { }
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
                var initialTitleEn = idea.title;
                var newTitleEn = idea.title + "NeuerNameEn";

                frisby.create('i18n: Put an Update to simple i18nString, defaultLanguage')
                    .put(URL + '/ideas/' + idea.id, {title: newTitleEn})
                    .auth('helmut', 'helmut')
                    .expectStatus(200)
                    .expectHeader('yp-language', 'de')
                    .expectJSON({
                        title: newTitleEn
                    })
                    .afterJSON(function (updatedIdea) {
                        expect(updatedIdea.title).not.toEqual(initialTitleEn);

                        frisby.create('i18n: Get idea, "de" language given')
                            .get(URL + '/ideas/' + ideas[0].id)
                            .addHeader('yp-language', 'de')
                            .expectStatus(200)
                            .expectJSON({
                                id: String,
                                title: String
                            })
                            .expectHeader('yp-language', 'de')
                            .afterJSON(function (ideaDe) {

                                frisby.create('i18n: Put an Update to i18nString to resetLanguage, defaultLanguage')
                                    .put(URL + '/ideas/' + idea.id, {title: initialTitleEn})
                                    .auth('helmut', 'helmut')
                                    .expectStatus(200)
                                    .expectHeader('yp-language', 'de')
                                    .expectJSON({
                                        title: initialTitleEn
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


