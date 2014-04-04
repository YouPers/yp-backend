var error = require('../util/error'),
    _ = require('lodash');

function clean(Model, sentJson) {

    /**read only properties */
    delete sentJson._id;
    delete sentJson.id;
    delete sentJson.created_at;
    delete sentJson.modified_at;
    delete sentJson.modified_by;
    delete sentJson.created_by;

// ref properties: replace objects by ObjectId in case client sent whole object instead of reference, only
    // do this removal for properties of type ObjectID
    var schema = Model.schema;
    _.filter(schema.paths, function (path) {
        return (path.instance === 'ObjectID' || (path.caster && path.caster.instance === 'ObjectId'));
    })
        .forEach(function (myPath) {
            if (myPath.path in sentJson && _.isArray(sentJson[myPath.path])) {
                for (var i = 0; i < sentJson[myPath.path].length; i++) {
                    if ((!(typeof sentJson[myPath.path][i] === 'string' || sentJson[myPath.path][i] instanceof String))) {
                        sentJson[myPath.path][i] = sentJson[myPath.path][i].id;
                    }
                }
            } else if ((myPath.path in sentJson) && (!(typeof sentJson[myPath.path] === 'string' || sentJson[myPath.path] instanceof String))) {
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
 * @param Model
 * @returns {*}
 * @param sentObj
 * @param user
 */
function checkWritingPreCond(sentObj, user,  Model) {
    if (!sentObj) {
        return new error.MissingParameterError('expected JSON body in POST/PUT not found');
    }

    if (Model.modelName !== 'User' && !user) {
        return new error.NotAuthorizedError('Needs to be Authenticated and authorized to POST objects');
    }

    clean(Model, sentObj);

    // check whether owner is the authenticated user
    if (sentObj.owner && (user.id !== sentObj.owner)) {
        return new error.NotAuthorizedError('POST/PUT of object only allowed if owner of new object equals authenticated user', {
            user: user.id,
            owner: sentObj.owner
        });
    }

    return null; // everything is fine, proceed with request
}


module.exports = {
    checkWritingPreCond: checkWritingPreCond,
    clean: clean
};