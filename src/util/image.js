var fs = require('fs'),
    gm = require('gm');


var resizeImage = function(req, filePath, type, callback) {



    var dimensions = {
        user: [100, 100],
        campaign: [265, 167],
        organization: [265, 167]
    };

    var sizeA = dimensions[type][0];
    var sizeB = dimensions[type][1];

    var path = filePath;
    var pathResized = path + "_resized";

    req.log.debug('avatar: resize to \n'+sizeA+'x'+sizeB+path);


    // resize on fs using GraphicMagick
    gm(path)
        .define('jpeg:size='+sizeA+'x'+sizeB) // workspace
        .thumbnail(sizeA, sizeB + '^') // shortest side sizeB
        .gravity('center') // center next operation
        .extent(sizeA, sizeB) // canvas size
        .noProfile() // remove meta
        .write(pathResized, function(err){
            if (err) {
                return callback(err);
            }
            req.log.debug('avatar: resize complete\n' + pathResized);

            // read resized image from fs and store in db

            fs.readFile(pathResized, function (err, data) {


                var image = 'data:image/jpg;base64,' + new Buffer(data).toString('base64');

                callback(undefined, image);

                fs.unlink(path);
                fs.unlink(pathResized);

            });
        });

};


module.exports = {
    resizeImage: resizeImage
};