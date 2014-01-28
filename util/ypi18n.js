var _ = require('lodash');

var formatJSON = function formatJSON(req, res, body) {

    // copied from restify formatJSON

    if (body instanceof Error) {
        // snoop for RestError or HttpError, but don't rely on
        // instanceof
        res.statusCode = body.statusCode || 500;

        if (body.body) {
            body = body.body;
        } else {
            body = {
                message: body.message
            };
        }
    } else if (Buffer.isBuffer(body)) {
        body = body.toString('base64');
    }

    //////////////
    // added this part to translate all i18n attrs on the model
    if (body.i18nAttrs) {
        body.translateI18nAttrs(req.i18n);
    } else if (Array.isArray(body)) {
        _.forEach(body, function(objInArray) {
            if (objInArray.i18nAttrs) {
                objInArray.translateI18nAttrs(req.i18n);
            }
        });
    }

    // end adding
    ////////////////

    var data = JSON.stringify(body);
    res.setHeader('Content-Length', Buffer.byteLength(data));

    return (data);
};

var angularTranslateI18nextAdapter = function(req,res,next) {
    if (req.headers['yp-language']) {
        req.headers['cookie'] = 'i18next='+ req.headers['yp-language'];
    }
    return next();
};

module.exports = {
    i18nJsonFormatter: formatJSON,
    angularTranslateI18nextAdapter: angularTranslateI18nextAdapter
}