var conn = new Mongo();
var db = conn.getDB("test_database");
var delim = '|';

var qs = db.activities.aggregate(
    {$project: {number: 1, title:1, qualityFactor:1, qids: '$recWeights.question', negRecWeight: '$recWeights.negativeAnswerWeight', posRecWeight: '$recWeights.positiveAnswerWeight' }}
).result;


_.forEach(qs, function(a) {

    var weightString = '';
    for (var i = 0; i< a.negRecWeight.length; i++) {
        weightString = weightString + a.qids[i] + delim+  a.negRecWeight[i] + delim + a.posRecWeight[i] + delim;
    }
    weightString = weightString.slice(0,-1);
    print(a.number + delim + a._id + delim + a.title + delim + a.qualityFactor + delim +weightString);

});


