/**
 * YouPers Rest Errors - see list of codes below
 *
 * usage:
 *
 *  <code>() - use default message
 *  <code>(message) - use custom error message
 *  <code>({ message, body: {} } - custom message and response body with additional parameters, message is copied to body
 *
 */



var util = require('util');
var restify = require('restify');


var CODES = {
    Internal: {
        statusCode: 500,
        message: 'The server encountered an unexpected condition which prevented it from fulfilling the request.'
    },

    NotAuthorized: {
        statusCode: 403,
        message: 'The user is not authorized to access this resource.'
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

    BadRequest: {
        statusCode: 400,
        message: 'The request could not be understood by the server due to malformed syntax.'
    },
    BadMethod: {
        statusCode: 405,
        message: ''
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


module.exports = {};

var slice = Function.prototype.call.bind(Array.prototype.slice);

Object.keys(CODES).forEach(function (k) {
    var name = k;
    if (!/\w+Error$/.test(name)) {
        name += 'Error';
    }

    module.exports[name] = function (cause, message) {
        var index = 1;
        var opts = {
            restCode: k + 'Error',
            statusCode: CODES[k].statusCode,
            message: CODES[k].message // default message
        };

        if (cause && cause instanceof Error) {
            opts.cause = cause;
        } else if (typeof (cause) === 'object') {
            opts.body = cause.body;
            opts.cause = cause.cause;
            opts.statusCode = cause.statusCode || CODES[k].statusCode;

            // if a message is provided, override default message
            if(cause.message) {
                opts.message = cause.message;
            } else if(message) {
                opts.message = message;
            }

            // send error message in client response
            if(!cause.body) {
                cause.body = {};
            }
            cause.body.message = opts.message;
            cause.body.code = opts.restCode;
        } else { // no cause is provided
            if(cause) {
                opts.message = cause;
            }
            index = 0;
        }

        var args = slice(arguments, index);
        args.unshift(opts);
        restify.RestError.apply(this, args);
    };
    util.inherits(module.exports[name], restify.RestError);
    module.exports[name].displayName =
        module.exports[name].prototype.name =
            name;
});
