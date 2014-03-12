var error = require('../util/error'),
    mongoose = require('mongoose'),
    PaymentCode = mongoose.model('PaymentCode'),
    Campaign = mongoose.model('Campaign'),
    couponCode = require('coupon-code');

/**
 * @param values
 * @returns {Function}
 */
var generatePaymentCode = function generatePaymentCode() {
    return function (req, res, next) {

        var values = req.body;

        if(!values.campaign) {
            return next(new error.MissingParameterError({required: 'campaign'}));
        }

        var paymentCode = new PaymentCode({
            code: couponCode.generate(),
            service: values.service,
            productType: values.productType,
            users: values.users,
            campaign: values.campaign
        });

        paymentCode.save(function(err) {
            if(err) {
                return error.handleError(err, next);
            }
        });

        res.send(201, paymentCode );
        return next();
    };
};

/**
 * @param values
 * @returns {Function}
 */
var validatePaymentCode = function validatePaymentCode() {
    return function (req, res, next) {

        var code = req.body.code;

        if(!code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }

        PaymentCode.findOne({ code: code }).exec(function (err, paymentCode) {
            if(err) {
                return error.handleError(err, next);
            }

            if (!paymentCode) {
                return next(new error.ResourceNotFoundError({ code: code}));
            }

            res.send(200, paymentCode);
            return next();
        });
    };
};

/**
 * @param code
 * @returns {Function}
 */
var redeemPaymentCode = function redeemPaymentCode() {
    return function (req, res, next) {

        var code = req.body.code;
        var campaign = req.body.campaign;

        if(!code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }


        try {

            PaymentCode.findOne({ code: code }).exec(function (err, paymentCode) {
                if(err) {
                    return error.handleError(err, next);
                }
                if (!paymentCode) {
                    return next(new error.ResourceNotFoundError({ code: code}));
                }

                if(!paymentCode.campaign) {
                    return next(new error.MissingParameterError({required: 'campaign'}));
                }

                if(campaign && campaign !== paymentCode.campaign.toString()) {
                    return next(new error.InvalidArgumentError('paymentCode is assigned to a different campaign', {
                        current: campaign,
                        paymentCodeCampaign: paymentCode.campaign
                    }));
                }

                Campaign.findById(paymentCode.campaign).select('+paymentStatus').exec(function (err, campaign) {
                    if (err) {
                        return error.errorHandler(err, next);
                    }
                    if (!campaign) {
                        return next(new error.ResourceNotFoundError('Campaign not found.', { id: paymentCode.campaign }));
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

                        res.send(200, paymentCode);
                        return next();
                    });
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