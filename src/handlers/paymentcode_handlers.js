var error = require('../util/error'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
    crypto = require('crypto');


var encryptPaymentCodeValues = function (value) {

    var cipher = crypto.createCipher(config.paymentCodeTokenEncryption.algorithm, config.paymentCodeTokenEncryption.key);
    var encrypted = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
    return encrypted;
};

var decryptPaymentCodeValues = function (token) {
    var decipher = crypto.createDecipher(config.paymentCodeTokenEncryption.algorithm, config.paymentCodeTokenEncryption.key);
    var decrypted = decipher.update(token, 'hex', 'utf8') + decipher.final('utf8');

    return decrypted;
};

/**
 * @param values
 * @returns {Function}
 */
var generatePaymentCode = function getSocialEventsListFn(baseUrl, Model) {
    return function (req, res, next) {

        var value = req.body.value;

        var token = encryptPaymentCodeValues(value);

        res.send(201, { code: token });
        return next();
    };
};

/**
 * @param values
 * @returns {Function}
 */
var validatePaymentCode = function getSocialEventsListFn(baseUrl, Model) {
    return function (req, res, next) {

        var token = req.body.code;

        try {
            var value = decryptPaymentCodeValues(token);
            res.send(200, { value: value});
            return next();
        } catch(e) {
            return next(new error.InvalidArgumentError('Invalid token'));
        }
    };
};


module.exports = {
    generatePaymentCode: generatePaymentCode,
    validatePaymentCode: validatePaymentCode
};