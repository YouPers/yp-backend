var http = require('http');
var _ = require('lodash');
var fs = require('fs');
var Client = require('node-rest-client').Client;

process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});

var targetDir = '/tmp/apidocs/';
var baseUrl = 'http://localhost:8000';
var url = baseUrl + '/api-docs';

var client = new Client();

client.get(url, function(data, response) {
    var parsedData =  JSON.parse(data);

    fs.writeFile(targetDir + 'api-docs.json', JSON.stringify(parsedData), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("The file was saved!");
        }
    });

    _.forEach(parsedData.apis, function(api) {


        client.get(baseUrl + api.path, function(apidata, response) {

            var resourceName = api.path.split('/')[2];
            console.log(resourceName);

            fs.writeFile(targetDir + resourceName + '.json', JSON.stringify(apidata), function(err) {
                if(err) {
                    console.log(err);
                } else {
                    console.log("The file was saved!");
                }
            });
        });


    });
});