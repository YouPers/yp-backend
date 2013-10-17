module.exports = {

    getByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            Model.findOne({_id: req.params.id}).exec(function (err, obj) {
                    if (err) {
                        return next(err);
                    }
                    if (req.params.populate) {
                        obj.populate(req.params.populate, function (err) {
                            if (err) {
                                return next(err);
                            }
                            res.send(obj);
                            return next();
                        });
                    }
                }

            );
        };
    },

    getAllFn: function (baseUrl, Model) {
        return function (req, res, next) {
            if (req.params.populate) {
                console.log('getAllFn: Population with: ' + req.params.populate);
                Model.find().populate(req.params.populate).exec(function (err, objList) {
                    if (err) {
                        return next(err);
                    }
                    res.send(objList);
                    return next();
                });

            } else {
                Model.find().exec(function (err, objList) {
                    if (err) {
                        return next(err);
                    }
                    res.send(objList);
                    return next();
                });
            }
        };
    },

    postFn: function (baseUrl, Model) {
        return function (req, res, next) {
            var newObj = new Model(req.body);

            newObj.save(function (err) {
                if (err) {
                    console.log(err);
                    err.statusCode = 409;
                    return next(err);
                }
                res.header('location', baseUrl + '/' + newObj._id);
                res.send(201);
                return next();
            });
        };
    },

    deleteAllFn: function (baseUrl, Model) {
        return function (req, res, next) {
            Model.remove(function (err) {
                if (err) {
                    return next(err);
                }
                res.send(200);
            });
        };
    }

}
;