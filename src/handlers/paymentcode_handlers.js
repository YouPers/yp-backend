var error = require('ypbackendlib').error,
    mongoose = require('ypbackendlib').mongoose,
    PaymentCode = mongoose.model('PaymentCode'),
    Campaign = mongoose.model('Campaign'),
    couponCode = require('coupon-code'),
    generic = require('ypbackendlib').handlers;

/**
 * @returns {Function}
 */
var generatePaymentCode = function generatePaymentCode() {
    return function (req, res, next) {

        var values = req.body;

        if (!values || !values.productType || !values.topic) {
            return next(new error.MissingParameterError({
                required: [
                    'productType',
                    'topic'
                ]
            }));
        }

        var code = couponCode.generate();

        var paymentCode = new PaymentCode({
            code: code,
            strippedCode: _stripCode(code),
            topic: values.topic,
            productType: values.productType,
            users: values.users,
            author: req.user._id,
            orderNumber: values.orderNumber
        });

        if (values.endorsementType) {
            paymentCode.endorsementType = values.endorsementType;
        }
        if (values.marketPartner) {
            paymentCode.marketPartner = values.marketPartner;
        }
        paymentCode.save(generic.writeObjCb(req, res, next));

    };
};

function _stripCode(code) {
    return code.toLowerCase().replace(/\W/g, '').toLowerCase();
}


/**
 * @returns {Function}
 */
var validatePaymentCode = function validatePaymentCode() {
    return function (req, res, next) {

        var code = req.body.code;

        if (!code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }

        PaymentCode.findOne({
            strippedCode: _stripCode(code),
            campaign: {$exists: false}
        }).exec(function (err, paymentCode) {
            if (err) {
                return error.handleError(err, next);
            }

            if (!paymentCode) {
                return next(new error.ResourceNotFoundError({code: code}));
            }

            if (paymentCode.topic) {

                if (!req.body.topic) {
                    return next(new error.MissingParameterError({required: 'topic'}));
                }

                var topic = paymentCode.topic.toString();
                if (topic !== req.body.topic) {
                    return next(new error.InvalidArgumentError({invalid: 'topic', expected: topic}));
                }
            }

            if (paymentCode.campaign) {
                return next(new error.InvalidArgumentError({code: 'already used'}));
            }


            res.send(200, paymentCode);
            return next();
        });
    };
};

/**
 * @returns {Function}
 */
var redeemPaymentCodeFn = function redeemPaymentCodeFn() {
    return function (req, res, next) {

        var code = req.body.code;
        var campaignId = req.body.campaign;

        if (!code) {
            return next(new error.MissingParameterError({required: 'code'}));
        }

        if (!campaignId) {
            return next(new error.MissingParameterError({required: 'campaign'}));
        }

        try {

            PaymentCode.findOne({
                strippedCode: _stripCode(code),
                campaign: {$exists: false}
            }).exec(function (err, paymentCode) {
                if (err) {
                    return error.handleError(err, next);
                }
                if (!paymentCode) {
                    return next(new error.ResourceNotFoundError({code: code}));
                }


                Campaign.findById(campaignId).select('+paymentStatus').exec(function (err, campaign) {
                    if (err) {
                        return error.errorHandler(err, next);
                    }
                    if (!campaign) {
                        return next(new error.ResourceNotFoundError('Campaign not found.', {id: campaignId}));
                    }

                    if (paymentCode.topic && paymentCode.topic !== campaign.topic) {
                        return next(new error.InvalidArgumentError('Invalid topic', {
                            expected: paymentCode.topic,
                            campaignTopic: campaign.topic
                        }));
                    }


                    if (campaign.paymentStatus === 'paid') {
                        return next(new error.BadMethodError('Campaign is already paid.'));
                    }

                    campaign.paymentStatus = 'paid';

                    campaign.productType = paymentCode.productType;

                    campaign.save(function (err) {
                        if (err) {
                            return error.handleError(err, next);
                        }

                        paymentCode.campaign = campaign.id;
                        paymentCode.save(generic.writeObjCb(req, res, next));

                    });
                });
            });


        } catch (e) {
            return next(new error.InvalidArgumentError('Invalid token'));
        }
    };
};


module.exports = {
    generatePaymentCode: generatePaymentCode,
    validatePaymentCode: validatePaymentCode,
    redeemPaymentCode: redeemPaymentCodeFn
};