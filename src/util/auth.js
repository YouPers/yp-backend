var mongoose = require('mongoose');
var jwt = require('jwt-simple');
var passport = require('passport');
var passportHttp = require('passport-http');
//  var  OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var GitHubStrategy = require('passport-github').Strategy;

var error = require('../util/error');
var _ = require('lodash');
var config = require('../config/config');
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

    _loadUser({$or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase()}
    ]}, function (err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false);
        }
        if (!user.validPassword(password)) {
            return done(null, false);
        }
        return done(null,user);
    });
};

function _loadUser(finder, cb) {
    return mongoose.model('User').find(finder)
        .select(mongoose.model('User').privatePropertiesSelector)
        .populate('profile campaign')
        .exec(function(err, users) {
            if (err) {
                return cb(err);
            }

            if (!users || users.length === 0) {
                return cb(err, null);
            }

            if (users.length > 1) {
                return cb(new Error('More than one user found for the crendentials, should not be possible'));
            }

            return cb(err, users[0]);
        });
}


function _getOAuth2ProviderCallbackFn(providerName, providerProfileToUserMappingFn, profileUpdateFn) {
    return function (accessToken, refreshToken, providerProfile, done) {
        _loadUser({provider: providerName, providerId: providerProfile.id }, function (err, user) {
            if (err) {
                return done(err);
            }
            if (user) {
                // we have an existing user for this provider id and providerId, so we return it
                return done(err, user);
            }

            // we do not have a user for this credentials, so we create one
            var UserModel =  mongoose.model('User');
            user = new UserModel(providerProfileToUserMappingFn(providerProfile, accessToken, refreshToken));
            user.save(function (err, savedUser) {
                if (err) {
                    return done(err);
                }
                if (profileUpdateFn && _.isFunction(profileUpdateFn)) {
                    mongoose.model('Profile')
                        .findById(savedUser.profile)
                        .exec(function (err, savedProfile) {
                            if (err) {
                                return done(err);
                            }

                            profileUpdateFn(savedProfile, providerProfile);
                            return savedProfile.save(function(err, savedProfile) {
                                if (err) {
                                    return done(err);
                                }
                                return done(err, savedUser);
                            });
                        });
                } else {
                    return done(err, savedUser);
                }

            });
        });

    };
}

var _gitHubVerifyCallback = _getOAuth2ProviderCallbackFn('github',
    function userMappingFn (providerProfile, accessToken, refreshToken) {
        return {
            firstname: providerProfile.username,
            lastname: providerProfile.username,
            fullname: providerProfile.displayName || providerProfile.username,
            accessToken: accessToken || '',
            refreshToken: refreshToken || '',
            provider: 'github',
            providerId: providerProfile.id,
            emails: providerProfile.emails,
            photos: providerProfile.photos || [],
            email: providerProfile.emails[0].email,
            avatar: providerProfile._json.avatar_url,
            emailValidatedFlag: true,
            username: providerProfile.username,
            roles: ['individual']
        };
    }
);

var _facebookVerifyCallback = _getOAuth2ProviderCallbackFn('facebook',
    function (providerProfile, accessToken, refreshToken) {
        return {
            firstname: providerProfile.name.givenName,
            lastname: providerProfile.name.familyName,
            fullname: providerProfile.displayName || providerProfile.username,
            accessToken: accessToken || '',
            refreshToken: refreshToken || '',
            provider: 'facebook',
            providerId: providerProfile.id,
            emails: providerProfile.emails,
            photos: providerProfile.photos || [],
            email: providerProfile.emails[0].value,
            avatar: providerProfile.photos[0].value,
            emailValidatedFlag: true,
            username: providerProfile.displayName,
            roles: ['individual']
        };
    },
    function profileUpdateFn(existingProfile, providerProfile) {
        existingProfile.gender = providerProfile.gender;
    }
);


function _validateBearerToken(token, done) {
    if (token) {
        try {
            var decoded = jwt.decode(token, config.accessTokenSecret);

            if (decoded.exp <= Date.now()) {
                return done(new Error('Token Expired Error'));
            }

            var userId = decoded.iss;

            _loadUser({_id: mongoose.Types.ObjectId(userId)}, function (err, user) {
                if (err) {
                    return error.handleError(err, done);
                }
                if (!user) {
                    return done(null, false);
                }

                if (user.lastLogin && moment(user.lastLogin).isBefore(moment().startOf('day'))) {
                    // publish event: first login today
                    user.lastLogin = new Date();
                    user.save();
                    mongoose.model('User').emit('User:firstLoginToday', user);
                }

                return done(null, user, {scope: 'all', roles: user.roles});
            });
        } catch (err) {
            return done(err);
        }
    } else {
        done();
    }
}

function _calculateToken(user) {
    var expires = moment().add(7, 'days').valueOf();

    return {
        encodedToken: jwt.encode({iss: user.id, exp: expires}, config.accessTokenSecret),
        expires: expires
    };
}

function loginAndExchangeTokenRedirect(req, res, next) {
    if (!req.user) {
        return error.handleError(new Error('User must be defined at this point'), next);
    }
    var tokenInfo = _calculateToken(req.user);

    res.header('Location', config.webclientUrl + '/#home?token=' + tokenInfo.encodedToken + '&expires=' + tokenInfo.expires);
    res.send(302);
}


function loginAndExchangeTokenAjax(req, res, next) {
    if (!req.user) {
        return error.handleError(new Error('User must be defined at this point'), next);
    }
    req.log.trace({user: req.user}, '/login: user authenticated');

    var tokenInfo = _calculateToken(req.user);

    var payload = {
        user: req.user,
        token: tokenInfo.encodedToken,
        expires: tokenInfo.expires
    };

    res.send(payload);
    return next();
}

function setupPassport(passport) {
    // setup authentication, currently only HTTP Basic auth over HTTPS is supported
    passport.use(new passportHttp.BasicStrategy(validateLocalUsernamePassword));
    passport.use(new GitHubStrategy({
            clientID: 'ddfb0568a53ead210f61',
            clientSecret: 'ee82f353b27509bb1cb9269b26b02b611e528fe6',
            callbackURL: "http://localhost:8000/auth/github/callback",
            scope: "user"
        },
        _gitHubVerifyCallback
    ));

    passport.use(new FacebookStrategy({
            clientID: '1443351149277228',
            clientSecret: 'd910fee6236a08c7606069f6bb72f626',
            callbackURL: "http://localhost:8000/auth/facebook/callback",
            scope: ["public_profile", "email"],
            enableProof: false,
            profileFields: ['id', 'displayName', 'photos', 'email', 'name', 'last_name', 'first_name']
        },
        _facebookVerifyCallback
    ));
    passport.use(new BearerStrategy(_validateBearerToken));

}

module.exports = {
    roleBasedAuth: roleBasedAuth,
    isAdminForModel: isAdminForModel,
    roles: roles,
    accessLevels: accessLevels,
    canAssign: canAssign,
    checkAccess: checkAccess,
    loginAndExchangeTokenRedirect: loginAndExchangeTokenRedirect,
    loginAndExchangeTokenAjax: loginAndExchangeTokenAjax,
    setupPassport: setupPassport
};
