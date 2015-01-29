var yplib = require('ypbackendlib'),
    mongoose = yplib.mongoose,
    LineByLineReader = require('line-by-line'),
    _ = require('lodash');


require('../src/util/database').initializeDb();
var ideaModel = mongoose.model('Idea');

var topics = {
    Activity: "53b416fba43aac62a2debda2",
    Social: "53b416fba43aac62a2debda3",
    Food: "53b416cfa43aac62a2debda1"
};

var lr = new LineByLineReader('text.txt');


lr.on('line', function (line) {
    var fields = line.split('\t');

    var myTopics = [];
    _.forEach(fields[5].split(','), function(topic) {
        if (topic && topics[topic]) {
            myTopics.push(topics[topic]);
        }
    });

    var myCats = [];
    _.forEach(fields[11].split(','), function(cat) {
        if (cat) {
            myCats.push(cat);
        }
    });

    var myIdea = {
        number: fields[0],
        titleI18n: {
            "en": fields[1],
            "de": fields[2]
        },
        descriptionI18n: {
            "en": fields[3],
            "de": fields[4]
        },
        topics: myTopics,
        defaultduration: fields[6],
        qualityFactor: fields[7],
        picture: fields[8],
        defaultfrequency: fields[9],
        defaultexecutiontype: fields[10],
        categories: myCats
    };

    var idea = new ideaModel(myIdea);

    idea.save(function (err, savedIdea) {
        if (err) {
            console.log(err);
        }
        console.log("saved idea: " + savedIdea.number);
    });

});

lr.on('error', function (err) {
    console.log(err);
});

lr.on('end', function () {

});


