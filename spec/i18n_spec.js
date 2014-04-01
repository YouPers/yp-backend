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

frisby.create('i18n: GET all assessments, no language given, check default')
    .get(URL + '/assessments')
    .expectStatus(200)
    .expectJSON('*', {
        id: String,
        name: String
    })
    .expectHeader('yp-language', 'de')
    .afterJSON(function (assessments) {

        // Use data from previous result in next test
        frisby.create('i18n: Get one assessment, no language given, check default')
            .get(URL + '/assessments/' + assessments[0].id)
            .expectStatus(200)
            .expectJSON({
                id: String,
                name: String
            })
            .expectHeader('yp-language', 'de')
            .afterJSON(function (assessment) {
                var initialNameDe = assessment.name;
                var newNameDe = assessment.name + "NeuerNameDe";

                frisby.create('i18n: Put an Update to simple i18nString, defaultLanguage')
                    .put(URL + '/assessments/' + assessment.id, {name: assessment.name + "NeuerNameDe"})
                    .auth('stefan', 'stefan')
                    .expectStatus(200)
                    .expectHeader('yp-language', 'de')
                    .expectJSON({
                        name: newNameDe
                    })
                    .afterJSON(function (updatedAssessment) {
                        expect(updatedAssessment.name).not.toEqual(initialNameDe);

                        frisby.create('i18n: Get assessment, "en" language given')
                            .get(URL + '/assessments/' + assessments[0].id)
                            .addHeader('yp-language', 'en')
                            .expectStatus(200)
                            .expectJSON({
                                id: String,
                                name: String
                            })
                            .expectHeader('yp-language', 'en')
                            .afterJSON(function (assessmentEn) {
                                expect(assessmentEn.name).not.toEqual(updatedAssessment.name);

                                frisby.create('i18n: Put an Update to i18nString to resetLanguage, defaultLanguage')
                                    .put(URL + '/assessments/' + assessment.id, {name: initialNameDe})
                                    .auth('stefan', 'stefan')
                                    .expectStatus(200)
                                    .expectHeader('yp-language', 'de')
                                    .expectJSON({
                                        name: initialNameDe
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


