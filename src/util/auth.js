var mongoose = require('mongoose');
var jwt = require('jwt-simple');
var passport = require('passport');
var error = require('../util/error');
var _ = require('lodash');
var env = process.env.NODE_ENV || 'development';
var config = require('../config/config')[env];
var moment = require('moment');



var roles = {
        anonymous: 'anonymous',
        individual: 'individual',
        orgadmin: 'orgadmin',
        campaignlead: 'campaignlead',
        productadmin: 'productadmin',
        systemadmin: 'systemadmin'
    },
    canAssignRole = { // defines what roles (value) are allowed to assign a given role (key) to a new/updated user
        individual: [roles.anonymous, roles.individual, roles.productadmin, roles.systemadmin],
        campaignlead: [roles.individual],
        orgadmin: [roles.individual, roles.productadmin, roles.systemadmin],
        productadmin: [ roles.productadmin, roles.systemadmin],
        systemadmin: [ roles.systemadmin]
    },
    accessLevels = {
        al_all: [roles.anonymous, roles.individual, roles.orgadmin, roles.campaignlead, roles.productadmin, roles.systemadmin],
        al_anonymousonly: [roles.anonymous],
        al_user: [roles.individual, roles.orgadmin, roles.campaignlead, roles.productadmin, roles.systemadmin ],
        al_individual: [roles.individual, roles.productadmin, roles.systemadmin ],
        al_campaignlead: [roles.orgadmin, roles.campaignlead, roles.systemadmin ],
        al_orgadmin: [roles.orgadmin, roles.systemadmin ],
        al_admin: [roles.productadmin, roles.systemadmin],
        al_productadmin: [ roles.productadmin, roles.systemadmin ],
        al_systemadmin: [roles.systemadmin ]
    };


function roleBasedAuth(accessLevel) {
    if (!accessLevels[accessLevel]) {
        throw new Error('unknown accessLevel: ' + accessLevel);
    }
    return function (req, res, next) {
        passport.authenticate(['bearer', 'basic' ], function (err, user, info) {
            if (err) {
                return error.handleError(err, next);
            }
            checkAccess(user, accessLevel, function (err) {
                if (err) {
                    return error.handleError(err, next);
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
            if (callback) {
                return callback();
            } else {
                return true;
            }
        } else if (Array.isArray(accessLevel) &&
            (_.contains(accessLevel, roles.anonymous))) {
            if (callback) {
                return callback();
            } else {
                return true;
            }
        } else {
            if (callback) {
                return callback(user ? new error.NotAuthorizedError() : new error.UnauthorizedError());
            } else {
                return false;
            }

        }
    }

    var suppliedRoles = getRolesFromUser(user);
    if (!Array.isArray(accessLevel)) {
        accessLevel = accessLevels[accessLevel];
    }

    if (_.intersection(accessLevel, suppliedRoles).length > 0) {
        if (callback) {
            return callback();
        } else {
            return true;
        }
    } else {
        if (callback) {
            return callback(new error.NotAuthorizedError());
        } else {
            return false;
        }
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
var isAdminForModel = function isAdminForModel(user, Model) {
    var validAdminRolesForThisModel = [];
    if (Array.isArray(Model)) {
        validAdminRolesForThisModel = Model;
    } else if (Model.adminRoles && Array.isArray(Model.adminRoles)) {
        validAdminRolesForThisModel = Model.adminRoles;
    }
    var userRoles = getRolesFromUser(user);
    return (_.intersection(userRoles, validAdminRolesForThisModel).length > 0);
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

/**
 * checkes whether the supplied credentials are belonging to a valid user in the local database.
 * The parameter username may also be used with the user's email address.
 * Calls done(error, user) at the end.
 *
 * @param username the user's username or email address
 * @param password the user's password
 * @param done callback to be called with the result, takes to arguments error and user. user is passedwhen
 * authenication is successful, otherwise it will pass false.
 */
var validateLocalUsernamePassword = function (username, password, done) {

    mongoose.model('User')
        .findOne()
        .or([
            { username: username.toLowerCase() },
            { email: username.toLowerCase()}
        ])
        // select the 'private' attributes from the user that are hidden if another user loads the user object
        .select(mongoose.model('User').privatePropertiesSelector)
        .populate('profile')
        .populate('campaign')
        .exec(function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            if (!user.validPassword(password)) {
                return done(null, false);
            }
            return done(null, user);
        });
};

var gitHubVerifyCallback = function (accessToken, refreshToken, profile, done) {

    mongoose.model('User').findOneAndUpdate(
        { provider: 'github', providerId: profile.id },
        {
            firstname: profile.username,
            lastname: "",
            fullname: profile.displayName || profile.username,
            accessToken: accessToken || '',
            refreshToken: refreshToken || '',
            provider: 'github',
            providerId: profile.id,
            emails: profile.emails,
            photos: profile.photos || [],
            email: profile.emails[0].email,
            avatar: profile._json.avatar_url,
            emailValidatedFlag: true,
            username: profile.username,
            roles: ['individual']
        },
        {upsert: true},
        function (err, user) {
            return done(err, user);
        });
};

var facebookVerifyCallback = function(accessToken, refreshToken, profile, done) {
    mongoose.model('User').findOneAndUpdate(
        { provider: 'facebook', providerId: profile.id },
        {
            firstname: profile.name.givenName,
            lastname: profile.name.familyName,
            fullname: profile.displayName || profile.username,
            accessToken: accessToken || '',
            refreshToken: refreshToken || '',
            provider: 'facebook',
            providerId: profile.id,
            emails: profile.emails,
            photos: profile.photos || [],
            email: profile.emails[0].value,
            avatar: profile.photos[0].value,
            emailValidatedFlag: true,
            username: profile.displayName,
            roles: ['individual']
        },
        {upsert: true},
        function (err, user) {
            return done(err, user);
        });
};

function validateBearerToken(token, done) {
    if (token) {
        try {
            var decoded = jwt.decode(token, config.accessTokenSecret);

            if (decoded.exp <= Date.now()) {
                return done(new Error('Token Expired Error'));
            }

            var userId = decoded.iss;
            mongoose.model('User').findById(userId)
                .select(mongoose.model('User').privatePropertiesSelector)
                .populate('profile campaign')
                .exec(function(err, user) {
                if (err) {
                    return error.handleError(err, done);
                }
                if (!user) { return done(null, false); }
                return done(null, user);
            });
        } catch (err) {
            return done(err);
        }
    } else {
        done();
    }
}

function calculateToken(user, expires) {
    return jwt.encode({
        iss: user.id,
        exp: expires
    }, config.accessTokenSecret);
}

function loginAndExchangeTokenRedirect(req, res, next) {
    if (!req.user) {
        return error.handleError(new Error('User must be defined at this point'), next);
    }

    var expires = moment().add('days', 7).valueOf();
    var token = calculateToken(req.user, expires);


    res.header('Location', config.webclientUrl + '/#home?token='+token + '&expires=' +expires);
    res.send(302);
}


function loginAndExchangeTokenAjax(req, res, next) {
    if (!req.user) {
        return error.handleError(new Error('User must be defined at this point'), next);
    }
    req.log.trace({user: req.user},'/login: user authenticated');

    var expires = moment().add('days', 7).valueOf();
    var token = calculateToken(req.user, expires);

    var payload = {
        user: req.user,
        token: token,
        expires: expires
    };

    res.send(payload);
    return next();
}

module.exports = {
    roleBasedAuth: roleBasedAuth,
    isAdminForModel: isAdminForModel,
    roles: roles,
    accessLevels: accessLevels,
    canAssign: canAssign,
    checkAccess: checkAccess,
    validateLocalUsernamePassword: validateLocalUsernamePassword,
    gitHubVerifyCallback: gitHubVerifyCallback,
    validateBearerToken: validateBearerToken,
    loginAndExchangeTokenRedirect: loginAndExchangeTokenRedirect,
    loginAndExchangeTokenAjax: loginAndExchangeTokenAjax,
    facebookVerifyCallback: facebookVerifyCallback
};
