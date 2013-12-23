var restify = require('restify'),
    _ = require('lodash');

function checkWritingPreCond(req, Model) {
    if (!req.body) {
        return new restify.InvalidArgumentError('exptected JSON body in POST/PUT not found');
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
        return new restify.ConflictError('POST/PUT of object only allowed if owner of new object equals authenticated user');
    }

    return null; // everything is fine, proceed with request
}


module.exports = {
    checkWritingPreCond: checkWritingPreCond
};