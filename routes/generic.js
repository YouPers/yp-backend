var _ = require('lodash');

module.exports = {

    getByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            if (req.params.populate) {
                Model.findOne({_id: req.params.id}).populate(req.params.populate).exec(function (err, obj) {
                    if (err) {
                        return next(err);
                    }
                    res.send(obj);
                    return next();
                });
            } else {
                Model.findOne({_id: req.params.id}).exec(function (err, obj) {
                    if (err) {
                        return next(err);
                    }
                    res.send(obj);
                    return next();
                });
            }
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
            if (!req.body) {
                return next(new Error('exptected JSON body in POST'));
            }
            // replace objects by ObjectId in case client sent whole object instead of reference only
            // do this check only for properties of typ ObjectID
            var schema = Model.schema;
            _.filter(schema.paths, function (path) {
                return (path.instance === 'ObjectID');
            })
                .forEach(function (myPath) {
                    if ((myPath.path in req.body) && (!(typeof req.body[myPath.path] === 'string' || req.body[myPath.path] instanceof String))) {
                        req.body[myPath.path] = req.body[myPath.path].id;
                    }
                });


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
    },

    deleteByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            Model.remove({_id: req.params.id}, function (err) {
                if (err) {
                    return next(err);
                }
                res.send(200);
            });
        };
    }

}
;