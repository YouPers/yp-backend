/**
 * Created by retoblunschi on 20.12.13.
 */

var roles = {
        anonymous: 'anonymous',
        individual: 'individual',
        healthpromoter: 'healthpromoter',
        productadmin: 'productadmin',
        systemadmin: 'systemadmin'
    },
    canAssignRole = { // defines what roles (value) are allowed to assign a give role (key) to a new/updated user
        anonymous: [roles.anonymous, roles.individual, roles.healthpromoter, roles.productadmin, roles.systemadmin],
        individual: [roles.anonymous, roles.individual, roles.productadmin, roles.systemadmin],
        healthpromoter: [roles.anonymous, roles.productadmin, roles.systemadmin],
        productadmin: [ roles.productadmin, roles.systemadmin],
        systemadmin: [ roles.systemadmin]
    },
    accessLevels = {
        al_all: [roles.anonymous, roles.individual, roles.healthpromoter, roles.productadmin, roles.systemadmin],
        al_anonymousonly: [roles.anonymous],
        al_user: [roles.individual, roles.healthpromoter, roles.productadmin, roles.systemadmin ],
        al_individual: [roles.individual, roles.productadmin, roles.systemadmin ],
        al_healthpromoter: [roles.individual, roles.healthpromoter, roles.systemadmin ],
        al_admin: [roles.productadmin, roles.systemadmin],
        al_productadmin: [ roles.productadmin, roles.systemadmin ],
        al_systemadmin: [roles.systemadmin ]
    },
    passport = require('passport'),
    restify = require('restify'),
    _ = require('lodash');


function roleBasedAuth(accessLevel) {
    if (!accessLevels[accessLevel]) {
        throw new Error('unkonwn accessLevel: ' + accessLevel);
    }
    return function (req, res, next) {
        passport.authenticate('basic', function (err, user, info) {
            if (err) {
                return next(err);
            }
            checkAccess(user, accessLevel, function (err) {
                if (err) {
                    return next(err);
                } else {
                    req.user = user;
                    return next();
                }
            });

        })(req, res, next);
    };
}

function checkAccess(user, accessLevel, callback) {
    // if we do not have a user, we only allow anonymous
    if (!user) {
        if (accessLevel === 'al_all' || accessLevel === 'al_anonymousonly') {
            return callback();
        } else if (Array.isArray(accessLevel) &&
            (_.contains(accessLevel, roles.anonymous ))) {
            return callback();
        } else {
            return callback(user ? new restify.NotAuthorizedError("User not authorized for this ressource"): new restify.UnauthorizedError('Authentication failed'));
        }
    }

    var suppliedRoles = getRolesFromUser(user);
    if (!Array.isArray(accessLevel)) {
        accessLevel = accessLevels[accessLevel];
    }

    if (_.intersection(accessLevel, suppliedRoles).length > 0) {
        return callback();
    } else {
        return callback(new restify.NotAuthorizedError("User is not authorized for this ressource."));
    }
}

function getRolesFromUser(user) {
    var userRoles = [];
    if (user && user.roles) {
        userRoles = user.roles;
    } else if (Array.isArray((user))) {
        userRoles = user;
    } else if (_.isString(user)) {
        userRoles = [user];
    } else if (!user) {
        userRoles = [roles.anonymous];
    }
    return userRoles;
}
var isAdmin = function (user) {
    var userRoles = getRolesFromUser(user);
    return _.contains(userRoles, roles.productadmin) || _.contains(userRoles, roles.systemadmin);
};

var canAssign = function (loggedInUser, requestedRoles) {
    requestedRoles = Array.isArray(requestedRoles) ? requestedRoles : [requestedRoles];

    var loggedInRoles = getRolesFromUser(loggedInUser);
    var canEdit = true;
    _.forEach(requestedRoles, function (requestedRole) {
        if (_.intersection(canAssignRole[requestedRole], loggedInRoles).length === 0) {
            canEdit = false;
        }
    });
    return canEdit;
};

module.exports = {
    roleBasedAuth: roleBasedAuth,
    isAdmin: isAdmin,
    roles: roles,
    accesslevels: accessLevels,
    canAssign: canAssign,
    checkAccess: checkAccess
};
