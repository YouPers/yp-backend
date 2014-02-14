var _ = require('lodash'),
    restify = require('restify'),
    ObjectId = require('mongoose').Schema.ObjectId,
    handlerUtils = require('./handlerUtils'),
    auth = require('../util/auth');

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

var processStandardQueryOptions = function (req, dbquery, Model) {
    if (req.user && auth.isAdmin(req.user) && Model.getAdminAttrsSelector) {
        dbquery.select(Model.getAdminAttrsSelector());
    }

    if (Model.getI18nPropertySelector && !req.params.i18n) {
        dbquery.select(Model.getI18nPropertySelector(req.locale || 'de'));
    }

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


/////////////////////////////////////
// the generic route handlers

module.exports = {

    addStandardQueryOptions: processStandardQueryOptions,

    getByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            var dbQuery = Model.findById(req.params.id);

            processStandardQueryOptions(req, dbQuery, Model)
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

            processStandardQueryOptions(req, dbQuery, Model)
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

            var err = handlerUtils.checkWritingPreCond(req, Model);

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
            // instead of using Model.remove directly, findOne in combination with obj.remove
            // is used in order to trigger
            // - schema.pre('remove', ... or
            // - schema.pre('remove', ...
            // see user_model.js for an example
            Model.find(function (err, objects) {
                if (err) {
                    return next(err);
                }
                _.forEach(objects, function (obj) {
                    obj.remove();
                });
                res.send(200);
            });
        };
    },

    deleteByIdFn: function (baseUrl, Model) {
        return function (req, res, next) {
            // instead of using Model.remove directly, findOne in combination with obj.remove
            // is used in order to trigger
            // - schema.pre('remove', ... or
            // - schema.pre('remove', ...
            // see user_model.js for an example
            Model.findOne({_id: req.params.id}).exec(function (err, obj) {
                if (err) {
                    return next(err);
                }
                obj.remove(function (err) {
                    res.send(200);
                });

            });
        };
    },

    putFn: function (baseUrl, Model) {
        return function (req, res, next) {
            var err = handlerUtils.checkWritingPreCond(req, Model);

            if (err) {
                return next(err);
            }

            // check whether this is an update for roles and check required privileges
            if (req.body.roles) {
                if (!auth.canAssign(req.user, req.body.roles)) {
                    return next(new restify.NotAuthorizedError('authenticated user has not enough privileges to assign these roles: ' + req.body.roles));
                }
            }

            var q = Model.findById(req.params.id);
            // if this Model has privateProperties, include them in the select, so we get the whole object
            // because we need to save it later!
            if (Model.privatePropertiesSelector) {
                q.select(Model.privatePropertiesSelector);
            }
            q.exec(function (err, objFromDb) {
                if (err) {
                    return next(err);
                }
                if (!objFromDb) {
                    return next(new restify.ResourceNotFoundError('no obj found with Id: ' + req.params.id));
                }

                // if this is an "owned" object
                if (objFromDb.owner) {

                    // only the authenticated same owner is allowed to edit
                    if (!objFromDb.owner.equals(req.user.id)) {
                        return next(new restify.NotAuthorizedError('authenticated user is not authorized ' +
                            'to update this ressource because he is not owner of the stored ressource'));
                    }

                    // he is not allowed to change the owner of the object
                    if (req.body.owner) {
                        if (!objFromDb.owner.equals(req.body.owner)) {
                            return next(new restify.NotAuthorizedError('authenticated user is not authorized ' +
                                'to change the owner of this object'));
                        }
                    }
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
    },

    params: {
        filter: {
            "name": "filter",
            "description": 'filters the results by adding a where clause, to see  the supported language and format see ',
            "dataType": 'string',
            "required": false,
            "allowMultiple": true,
            "paramType": "query"
        },
        sort: {
            "name": "sort",
            "description": 'sorts the results by the specified properties, add ":-1" to reverse sort: e.g. sort="created:-1"',
            "dataType": 'string',
            "required": false,
            "allowMultiple": true,
            "paramType": "query"
        },
        populate: {
            "name": "populate",
            "description": 'populates specified reference properties of the retrieved ressource with the full object,' +
                ' e.g. comments.author is of type ObjectId ref User, if you want the full user object instead of the ObjectId' +
                'add this queryParam: "populate="author". Supports multiple space separated values, also allows to populate' +
                'embedded subobject properties by using .-notation. Limitation: Only allows to populate over one DB-Collection, meaning' +
                'you can populate the comments.author, but you cannot populate ActivityEvent.Comment.Author, use ' +
                '"populatedeep" if you need this. \n' +
                'Use with caution, it may impact performance! ',
            "dataType": 'string',
            "required": false,
            "allowMultiple": true,
            "paramType": "query"
        },
        populatedeep: {
            "name": "populatedeep",
            "description": 'populates specified reference deep properties of the retrieved ressource with the full object,' +
                'use this if you need to go over more than 1 collection, see documentation of "populate" \n' +
                'Use with caution, it may impact performance! ',
            "dataType": 'string',
            "required": false,
            "allowMultiple": true,
            "paramType": "query"
        },
        limit: {
            "name": "limit",
            "description": 'limit the amount of returned objects, default is 100, max is 1000',
            "dataType": 'integer',
            "required": false,
            "default": 100,
            "allowMultiple": false,
            "paramType": "query"
        }
    }
};