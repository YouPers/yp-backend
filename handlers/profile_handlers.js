/**
 * Created by irig on 14.01.14.
 */
var handlerUtils = require('./handlerUtils');

var postFn = function (baseUrl, ProfileModel) {
    return function (req, res, next) {

        var err = handlerUtils.checkWritingPreCond(req, ProfileModel);

        if (err) {
            return next(err);
        }

        var newObj = new ProfileModel(req.body);

//        newObj.timestamp = newObj.timestamp || new Date();
        newObj.timestamp = new Date();

        req.log.trace(newObj, 'PostFn: Saving new Profile');
        // try to save the new object
        newObj.save(function (err) {
            if (err) {
                req.log.info({Error: err}, 'Error Saving in PostFn');
                err.statusCode = 409;
                return next(err);
            }

            res.header('location', baseUrl + '/' + newObj._id);
            res.send(201, newObj);
            return next();
        });
    };
};

var getActualProfile = function (baseUrl, Model) {
    return function (req, res, next) {

        Model.find({owner: req.user.id})
            .sort({timestamp: -1})
            .limit(1)
            .exec(function (err, result) {
                if (err) {
                    return next(err);
                }
                req.log.trace({foundAssResults: result}, 'GET Newest Ass Results');
                if (!result || result.length === 0){
                    res.send(204, []);
                    return next();
                }
                res.send(result[0]);
                return next();
            });
    };
};

var deleteAllFn = function (baseUrl, Model) {
    return function (req, res, next) {
        Model.remove({owner: req.user.id}, function (err) {
            if (err) {
                return next(err);
            }
            res.send(200);
        });
    };
};



module.exports = {
    postFn: postFn,
    getActualProfile: getActualProfile,
    deleteAllFn: deleteAllFn
};