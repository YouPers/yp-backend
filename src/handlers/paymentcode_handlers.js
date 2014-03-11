var error = require('../util/error'),
    config = require('../config/config')[process.env.NODE_ENV || 'development'],
    crypto = require('crypto'),
    mongoose = require('mongoose'),
    Campaign = mongoose.model('Campaign');


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
var generatePaymentCode = function generatePaymentCode() {
    return function (req, res, next) {

        if(!req.body.value) {
            return next(new error.MissingParameterError({required: 'value'}));
        }

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
var validatePaymentCode = function validatePaymentCode() {
    return function (req, res, next) {

        if(!req.body.code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }

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

/**
 * @param code
 * @returns {Function}
 */
var redeemPaymentCode = function redeemPaymentCode() {
    return function (req, res, next) {

        if(!req.body.code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }


        var campaignId = req.body.campaign;
        if(!campaignId) {
            return next(new error.MissingParameterError({required: 'campaign'}));
        }

        var token = req.body.code;

        try {
            var value = decryptPaymentCodeValues(token);

            Campaign.findById(campaignId).select('+paymentStatus').exec(function (err, campaign) {
                if (err) {
                    return error.errorHandler(err, next);
                }
                if (!campaign) {
                    return next(new error.ResourceNotFoundError('Campaign not found.', { id: campaignId }));
                }

                req.log.debug(campaign);

                if(campaign.paymentStatus === 'paid') {
                    return next(new error.BadMethodError('Campaign is already paid.'));
                }

                campaign.paymentStatus = 'paid';
                campaign.save(function(err) {
                    if(err) {
                        return error.handleError(err, next);
                    }

                    res.send(200, { value: value });
                    return next();
                });
            });

        } catch(e) {
            return next(new error.InvalidArgumentError('Invalid token'));
        }
    };
};


module.exports = {
    generatePaymentCode: generatePaymentCode,
    validatePaymentCode: validatePaymentCode,
    redeemPaymentCode: redeemPaymentCode
};