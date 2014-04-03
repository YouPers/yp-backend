var error = require('../util/error'),
    _ = require('lodash');

function cleanPopulated(Model, sentJson) {
// ref properties: replace objects by ObjectId in case client sent whole object instead of reference, only
    // do this removal for properties of type ObjectID
    var schema = Model.schema;
    _.filter(schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in sentJson) && (!(typeof sentJson[myPath.path] === 'string' || sentJson[myPath.path] instanceof String))) {
                sentJson[myPath.path] = sentJson[myPath.path].id;
            }
        });
}

/**
 * this function checks common preconditions to allow a writing access
 * - the req.body contains the object to write
 * - the owner of the object to write has to be the authenticated user
 * - populated properties that are refs in the model are replaced by the ObjectId.
 *
 * @param req
 * @param Model
 * @returns {*}
 */
function checkWritingPreCond(req, Model) {
    if (!req.body) {
        return new error.MissingParameterError('expected JSON body in POST/PUT not found');
    }

    if (Model.modelName !== 'User' && !req.user) {
        return new error.NotAuthorizedError('Needs to be Authenticated and authorized to POST objects');
    }

    cleanPopulated(Model, req.body);
    // check whether owner is the authenticated user
    if (req.body.owner && (req.user.id !== req.body.owner)) {
        return new error.NotAuthorizedError('POST/PUT of object only allowed if owner of new object equals authenticated user', {
            user: req.user.id,
            owner: req.body.owner
        });
    }

    return null; // everything is fine, proceed with request
}


module.exports = {
    checkWritingPreCond: checkWritingPreCond,
    cleanPopulated: cleanPopulated
};