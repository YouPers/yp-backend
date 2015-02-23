var port = process.env.PORT || 8000,
    URL = 'http://localhost:' + port,
    consts = require('./testconsts'),
    request = require('request-json');

var client = request.createClient(URL);


describe("Saving avatar to existing user", function () {

    it("should respond with 200", function (done) {
        var data = {
            name: "test.png"
        };
        client.setBasicAuth('test_ind1', 'yp');
        client.sendFile('users/' + consts.users.test_ind1.id + '/avatar', 'spec/test.png', data, function (err, res, body) {
            if (err) {
                return console.log(err);
            }
            expect(!err);
            expect(res.statusCode).toEqual(200);
            done();
        });
    });
});

