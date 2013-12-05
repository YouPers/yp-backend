var _ = require('lodash'),
    restify = require('restify'),
    ObjectId = require('mongoose').Schema.ObjectId;

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

var hasProp = function (o) {
    var has = [];
    for (var i = 1, l = arguments.length; i < l; i++) {
        var v = arguments[i];
        if (!_.isUndefined(o[v])) {
            has.push(v);
        }
    }
    return has.length && has;
};

function getsafe(obj, str) {
    if (!obj) {
        return null;
    }
    if (!Array.isArray(str)) {
        return getsafe(obj, str.split('.'));
    }

    if (!str.length) {
        return null;
    }

    var p = str.shift();
    var n = (p in obj) ? obj[p] : null;
    return str.length ? getsafe(n, str) : n;

}

var flatten = function (target, optsArg) {
    var output = {},
        opts = optsArg || {},
        delimiter = opts.delimiter || '.';

    function getkey(key, prev) {
        return prev ? prev + delimiter + key : key;
    }

    function step(object, prev) {
        Object.keys(object).forEach(function (key) {
            var isarray = opts.safe && Array.isArray(object[key]),
                type = Object.prototype.toString.call(object[key]),
                isobject = (type === "[object Object]" || type === "[object Array]");

            if (!isarray && isobject) {
                return step(object[key], getkey(key, prev));
            }

            output[getkey(key, prev)] = object[key];
        });
    }

    step(target);

    return output;
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

function addOp(str, isString, type) {
    var op, val;
    if (str[0] === '<') {
        if (str[1] === '<') {
            op = '$lt';
            val = str.substring(2);
        } else {
            op = '$lte';
            val = str.substring(1);
        }
    } else if (str[0] === '>') {
        if (str[1] === '>') {
            op = '$gt';
            val = str.substring(2);
        } else {
            op = '$gte';
            val = str.substring(1);
        }
    } else if (str[0] === '!') {
        if (isString) {
            op = '$regex';
            val = new RegExp('!(' + str.substring(1) + ')', 'i');
        } else {
            op = '$ne';
            val = str.substring(1);

        }
    } else if (type === ObjectId) {
        op = '$eq';
        val = new ObjectId(str);
    } else if (isString) {
        op = '$regex';
        val = new RegExp(str, 'i');
    } else {
        op = '$eq';
        val = str;
    }

    var query = {};
    query[op] = val;
    return query;
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


var _addFilter = function (queryParams, dbquery, Model) {
    var filters;
    if (!(filters = hasProp(queryParams, 'filter', '-filter', '+filter')) && isF(dbquery, 'or', 'nor', 'and')) {
        return dbquery;
    }

    var paths = getsafe(Model, 'options.display.list_fields');
    if (!paths) {
        paths = [];
        Model.schema.eachPath(function (p, v) {
            paths.push(p);
        });
    }

    _.each(flatten(queryParams.filter), function (v, k) {
        var ret = /^([+,-])?(.*)/.exec(k);
        var p = Model.schema.path(ret[2]);
        var type = p && p.options && p.options.type;
        var method;
        switch (ret[1]) {
            case '+':
                method = 'and';
                break;
            case '-':
                method = 'nor';
                break;
            default:
                method = 'where';
        }

        if (type === ObjectId) {
            var qp = {};
            qp[ret[2]] = v;
            dbquery = dbquery.find(qp);
        } else {

            dbquery = dbquery[method](ret[2], addOp(v, String === type || 'String' === type, type));
        }
        // console.log(' v',v,' k',k,' ',obj);

    });
    return dbquery;
};


var addQueryOptions = function (req, dbquery, Model) {
    dbquery = _addPagination(req.query, dbquery);
    dbquery = _addPopulation(req.query, dbquery);
    dbquery = _addSort(req.query, dbquery);
    dbquery = _addFilter(req.query, dbquery, Model);
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
            callback(null, doc);
        } else {
            var nextPath = listOfPathsToPopulate.shift();
            var pathBits = nextPath.split(".");

            // iterate over all documents and get Subdocuments to Populate, in case we get only a doc instead of array
            // create a fake array
            var listOfDocsToPopulate = [];
            _.forEach(Array.isArray(doc) ? doc : [doc], function (docEntry) {
                var items = resolveDocumentzAtPath(docEntry, pathBits.slice(0, -1));
                listOfDocsToPopulate = listOfDocsToPopulate.concat(items);
            });
            if (listOfDocsToPopulate.length > 0) {
                var lastPathBit = pathBits[pathBits.length - 1];
// There is an assumption here, that desendent documents which share the same path will all have the same model!
// If not, we must make a separate populate request for each doc, which could be slow.
                var model = listOfDocsToPopulate[0].constructor;
                var pathRequest = [
                    {
                        path: lastPathBit,
                        options: options
                    }
                ];
                console.log("Populating field '" + lastPathBit + "' of " + listOfDocsToPopulate.length + " " + model.modelName + "(s)");
                model.populate(listOfDocsToPopulate, pathRequest, function (err, results) {
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
        resolvedSoFar.forEach(function (subDoc) {
            var deeperResults = resolveDocumentzAtPath(subDoc, remainingPathBits);
            furtherResolved = furtherResolved.concat(deeperResults);
        });
        return furtherResolved;
    }
}

function checkWritingPreCond(req, Model) {
    if (!req.body) {
        return new Error('exptected JSON body in POST/PUT, found nothing');
    }

    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference, only
    // do this removal for properties of type ObjectID
    var schema = Model.schema;
    _.filter(schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in req.body) && (!(typeof req.body[myPath.path] === 'string' || req.body[myPath.path] instanceof String))) {
                req.body[myPath.path] = req.body[myPath.path].id;
            }
        });
    // check whether owner is the authenticated user
    if (req.body.owner && (req.user.id !== req.body.owner)) {

        return new restify.ConflictError('POST of object only allowed if owner == authenticated user');
    }

    return null; // everything is fine, proceed with request
}

/////////////////////////////////////
// the generic route handlers

module.exports = {

    getByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            var dbQuery = Model.findById(req.params.id);
            if (req.user && req.user.role === 'admin' && Model.getAdminAttrsSelector) {
                dbQuery.select(Model.getAdminAttrsSelector());
            }
            addQueryOptions(req, dbQuery, Model)
                .exec(function geByIdFnCallback(err, obj) {
                    if (err) {
                        return next(err);
                    }
                    if (!obj) {
                        res.send(204, []);
                        return next();
                    }

                    //check if the object has an owner and whether the current user owns the object
                    if (obj.owner && (!req.user ||
                        (obj.owner._id && (obj.owner._id + '' !== req.user.id)) || // case: owner is populated
                        (!obj.owner._id && !obj.owner.equals(req.user.id)))) {     // case: owner is not populated, is ObjectId
                        return next(new restify.NotAuthorizedError('Authenticated User does not own this object'));
                    }
                    if (req.query && req.query.populatedeep) {
                        deepPopulate(obj, req.query.populatedeep, {}, function (err, result) {
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

    getAllFn: function (baseUrl, Model, fromAllOwners) {
        return function (req, res, next) {

            // check if this is a "personal" object (i.e. has an "owner" property),
            // if yes only send the objects of the currently logged in user
            var finder = '';
            if (!fromAllOwners && Model.schema.paths['owner']) {
                if (!req.user || !req.user.id) {
                    return next(new restify.NotAuthorizedError('Authentication required for this object'));
                } else {
                    finder = {owner: req.user.id};
                }
            }
            var dbQuery = Model.find(finder);
            if (req.user && req.user.role === 'admin' && Model.getAdminAttrsSelector) {
                dbQuery.select(Model.getAdminAttrsSelector());
            }


            addQueryOptions(req,dbQuery , Model)
                .exec(function (err, objList) {
                    if (err) {
                        return next(err);
                    }
                    if (!objList || objList.length === 0) {
                        res.send(204, []);
                        return next();
                    }
                    if (req.query && req.query.populatedeep) {
                        deepPopulate(objList, req.query.populatedeep, {}, function (err, result) {
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

            var err = checkWritingPreCond(req, Model);

            if (err) {
                return next(err);
            }

            var newObj = new Model(req.body);


            req.log.trace(newObj, 'PostFn: Saving new Object');
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
    },

    putFn: function (baseUrl, Model) {
        return function (req, res, next) {
            var err = checkWritingPreCond(req, Model);

            if (err) {
                return next(err);
            }

            Model.findById(req.params.id).exec(function (err, objFromDb) {
                if (err) {
                    return next(err);
                }
                if (!objFromDb) {
                    return next(new restify.ResourceNotFoundError('no obj found with Id: ' + req.params.id));
                }

                if (objFromDb.owner &&
                    ((!objFromDb.owner.equals(req.user.id)) ||
                        (!objFromDb.owner.equals(req.body.owner)))
                    ) {
                    return next(new restify.NotAuthorizedError('authenticated user is not authorized to update this plan'));
                }

                _.extend(objFromDb, req.body);

                objFromDb.save(function (err, savedObj) {
                    if (err) {
                        return next(err);
                    }
                    res.send(200, savedObj);
                });
            });

        };
    },

    clean: function clean(restObj) {
        var update = _.extend({}, restObj);
        /**read only properties */
        delete update._id;
        delete update.created_at;
        delete update.modified_at;
        delete update.modified_by;
        delete update.created_by;
        return update;
    }
};