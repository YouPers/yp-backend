/**
 * YouPers Rest Errors - see list of codes below
 *
 * usage:
 *
 *  <code>() - use default message
 *  <code>(message) - use custom error message
 *  <code>(data) - default message and an object with additional parameters, for example the name of required/invalid fields or their values
 *  <code>(message, data) - custom error message and data object
 */



var util = require('util');
var restify = require('restify');
var mongoose = require('mongoose');


var CODES = {
    Internal: {
        statusCode: 500,
        message: 'The server encountered an unexpected condition which prevented it from fulfilling the request.'
    },

    NotAuthorized: {
        statusCode: 403,
        message: 'The user is not authorized to access this resource.'
    },
    Unauthorized: {
        statusCode: 401,
        message: 'The request requires user authentication.'
    },
    ResourceNotFound: {
        statusCode: 404,
        message: 'The specified resource was not found.'
    },
    Conflict: {
        statusCode: 409,
        message: 'The request could not be completed due to a conflict with the current state of the resource.'
    },
    InvalidArgument: {
        statusCode: 409,
        message: 'The specified argument is not valid.'
    },
    MissingParameter: {
        statusCode: 409,
        message: 'A parameter is required, but missing to access this resource.'
    },
    Validation: {
        statusCode: 409,
        message: 'Validation failed'
    },

    BadRequest: {
        statusCode: 400,
        message: 'The request could not be understood by the server due to malformed syntax.'
    },
    BadMethod: {
        statusCode: 405,
        message: 'The method specified is not allowed for this resource.'
    },

    InvalidContent: {
        statusCode: 400,
        message: ''
    },
    InvalidCredentials: {
        statusCode: 401,
        message: ''
    },
    InvalidHeader: {
        statusCode: 400,
        message: ''
    },
    InvalidVersion: {
        statusCode: 400,
        message: ''
    },
    PreconditionFailed: {
        statusCode: 412,
        message: ''
    },
    RequestExpired: {
        statusCode: 400,
        message: ''
    },
    RequestThrottled: {
        statusCode: 429,
        message: ''
    },
    WrongAccept: {
        statusCode: 406,
        message: ''
    }
};

/**
 * handle default errors, raise internal error if no match is found
 *
 * @param err
 * @param next
 * @returns {*}
 */
var handleError = function(err, next) {
    if(err instanceof restify.RestError) {
        return next(err);
    }
    if(err instanceof mongoose.Error.ValidationError) {
        return next(new module.exports.ValidationError(err));
    } else {
        return next(new module.exports.InternalError(err));
    }
};


module.exports = {
    handleError: handleError
};

//var slice = Function.prototype.call.bind(Array.prototype.slice);

Object.keys(CODES).forEach(function (k) {
    var name = k;
    if (!/\w+Error$/.test(name)) {
        name += 'Error';
    }

    module.exports[name] = function (message, cause) {
        var index = 1;
        var opts = {
            restCode: k + 'Error',
            statusCode: CODES[k].statusCode,
            message: CODES[k].message, // default message
            body: {

            }
        };

        if(!cause && message && typeof message !== 'string') {
            cause = message;
        } else if(message && typeof message === 'string') {
            opts.message = message;
        }

        if (cause && cause instanceof Error) {
            opts.cause = cause;
            opts.body.data = opts.body.data || {};
            opts.body.data.errors = cause.errors || cause.body.errors;
        } else if (typeof (cause) === 'object') {
            opts.body.data = cause;
        } else { // no cause is provided
            index = 0;
        }

        // send error message in client response
        opts.body.message = opts.message;
        opts.body.code = opts.restCode;

        var args = [ opts, opts.message ];
        restify.RestError.apply(this, args);
    };
    util.inherits(module.exports[name], restify.RestError);
    module.exports[name].displayName =
        module.exports[name].prototype.name =
            name;
});
