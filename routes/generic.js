var _ = require('lodash'),
    restify = require('restify');

////////////////////////////////////
// helper functions

var isF = function (o) {
    for (var i = 1, l = arguments.length; i < l; i++) {
        var v = arguments[i];
        if (!(_.isFunction(v) || _.isFunction(o[v]))) {
            return false;
        }
    }
    return true;
};

function split(val, delim, ret) {
    ret = ret || [];
    delim = delim || ',';
    if (!val) {
        return ret;
    }
    if (Array.isArray(val)) {
        val.forEach(function (v) {
            split(v, delim, ret);
        });
    } else {
        val.split(delim).forEach(function (v) {
            ret.push(v);
        });
    }
    return ret;
}


// query options

var _addPopulation = function (queryparams, dbquery) {
    // check whether our dbquery supports population
    if (!(dbquery && dbquery.populate && isF(dbquery, 'populate'))) {
        return dbquery;
    }

    var schema = dbquery && dbquery.model && dbquery.model.schema;

    //handle array style populate.
    if (Array.isArray(queryparams.populate) || typeof queryparams.populate === 'string') {
        _populate(schema, dbquery, split(queryparams.populate));
    } else {
        //handle object style populate.
        _.each(queryparams.populate, function (v, k) {
            _populate(schema, dbquery, flatJoin(v));
        });
    }
    delete queryparams.populate;
    return dbquery;
};

//mongoose throws an exception if you try and populate an non ObjectID
// this is suppose to guard against that. See if we can fix it.
function _populate(schema, dbquery, paths) {
    paths = Array.isArray(paths) ? paths : [paths];
    for (var i = paths.length; i--;) {
        var p = paths[i];
        if (schema && schema.path) {
            // TODO: (RBLU) Disable this check because it breaks population of deep porperties like 'events.comments', Fix later
            // var ref = schema.path(p);
            // if (ref && (ref.instance && ref.instance === 'ObjectID' || ref.caster && ref.caster.instance === 'ObjectID')) {
            dbquery.populate(p);
            //}
        } else {
            dbquery.populate(p);
        }
    }
}

function flatJoin(v) {
    var splits = split(v), ret = [];
    for (var i = splits.length; i--;) {
        ret.push(v + '.' + splits[i]);
    }
    return ret;
}


var _addPagination = function (queryparams, dbquery) {
    // pagination

    if (!queryparams) {
        return dbquery;
    }
    // check wheter our dbquery object supports skip and limit functions
    if (!isF(dbquery, 'skip', 'limit')) {
        return dbquery;
    }
    // max limit = 1000, default for limit (when called without value = 100)
    var limit = Math.min(queryparams && queryparams.limit && 0 + queryparams.limit || 100, 1000);
    var skip = queryparams && queryparams.skip || 0;
    if (queryparams) {
        // remove limit and skip because we have handled them
        delete queryparams.limit;
        delete queryparams.skip;
    }
    return dbquery.skip(skip).limit(limit);
};


var _addSort = function (queryparams, dbquery) {
    if (!(queryparams && queryparams.sort && isF(dbquery, 'sort'))) {
        return dbquery;
    }
    split(queryparams.sort).forEach(function (v, k) {
        var parts = v.split(':', 2);
        if (parts.length === 1) {
            parts.push(1);
        }
        var _s = {};
        _s[parts[0]] = parts[1];
        dbquery.sort(_s);
    });

    delete queryparams.sort;
    return dbquery;
};


var addQueryOptions = function (req, dbquery) {
    dbquery = _addPagination(req.query, dbquery);
    dbquery = _addPopulation(req.query, dbquery);
    dbquery = _addSort(req.query, dbquery);
    return dbquery;

};

/**
 * does population of properties for deep paths ("deep" meaning 3 or more Schemas involved)
 * inspired from here: https://gist.github.com/joeytwiddle/6129676
 *
 * @param doc
 * @param pathListString
 * @param options
 * @param callback
 */
function deepPopulate(doc, pathListString, options, callback) {
    var listOfPathsToPopulate = pathListString.split(" ");
    function doNext() {
        if (listOfPathsToPopulate.length === 0) {
// Now all the things underneath the original doc should be populated. Thanks mongoose!
            callback(null,doc);
        } else {
            var nextPath = listOfPathsToPopulate.shift();
            var pathBits = nextPath.split(".");
            var listOfDocsToPopulate = resolveDocumentzAtPath(doc, pathBits.slice(0,-1));
            if (listOfDocsToPopulate.length > 0) {
                var lastPathBit = pathBits[pathBits.length-1];
// There is an assumption here, that desendent documents which share the same path will all have the same model!
// If not, we must make a separate populate request for each doc, which could be slow.
                var model = listOfDocsToPopulate[0].constructor;
                var pathRequest = [{
                    path: lastPathBit,
                    options: options
                }];
                console.log("Populating field '"+lastPathBit+"' of "+listOfDocsToPopulate.length+" "+model.modelName+"(s)");
                model.populate(listOfDocsToPopulate, pathRequest, function(err,results){
                    if (err) {
                        return callback(err);
                    }
//console.log("model.populate yielded results:",results);
                    doNext();
                });
            } else {
// There are no docs to populate at this level.
                doNext();
            }
        }
    }
    doNext();
}

function resolveDocumentzAtPath(doc, pathBits) {
    if (pathBits.length === 0) {
        return [doc];
    }
//console.log("Asked to resolve "+pathBits.join(".")+" of a "+doc.constructor.modelName);
    var resolvedSoFar = [];
    var firstPathBit = pathBits[0];
    var resolvedField = doc[firstPathBit];
    if (resolvedField === undefined || resolvedField === null) {
// There is no document at this location at present
    } else {
        if (Array.isArray(resolvedField)) {
            resolvedSoFar = resolvedSoFar.concat(resolvedField);
        } else {
            resolvedSoFar.push(resolvedField);
        }
    }
//console.log("Resolving the first field yielded: ",resolvedSoFar);
    var remainingPathBits = pathBits.slice(1);
    if (remainingPathBits.length === 0) {
        return resolvedSoFar; // A redundant check given the check at the top, but more efficient.
    } else {
        var furtherResolved = [];
        resolvedSoFar.forEach(function(subDoc){
            var deeperResults = resolveDocumentzAtPath(subDoc, remainingPathBits);
            furtherResolved = furtherResolved.concat(deeperResults);
        });
        return furtherResolved;
    }
}


/////////////////////////////////////
// the generic route handlers

module.exports = {

    getByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            addQueryOptions(req, Model.findOne({_id: req.params.id}))
                .exec(function geByIdFnCallback(err, obj) {
                    if (err) {
                        return next(err);
                    }
                    if (!obj) {
                        return next(new restify.NotFoundError('Object not Found: ' + Model.modelName + ' with ID: ' + req.params.id));
                    }
                    if (req.query && req.query.populatedeep) {
                        deepPopulate(obj,req.query.populatedeep,{}, function(err, result) {
                           if (err) {
                               return next(err);
                           }
                            res.send(result);
                            return next();
                        });
                    } else {
                        res.send(obj);
                        return next();
                    }
                });
        };
    },

    getAllFn: function (baseUrl, Model) {
        return function (req, res, next) {
            addQueryOptions(req, Model.find())
                .exec(function (err, objList) {
                    if (err) {
                        return next(err);
                    }
                    if (req.query && req.query.populatedeep) {
                        deepPopulate(objList,req.query.populatedeep,{}, function(err, result) {
                            if (err) {
                                return next(err);
                            }
                            res.send(result);
                            return next();
                        });
                    } else {
                        res.send(objList);
                        return next();
                    }
                });
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