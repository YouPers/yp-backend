var i18n = require('i18next');

/**
 * translates the way we use to transport the language a user has chosen to the way i18next understands.
 * If no header 'yp-language' is in the request, i18next uses its algorithm to choose the language which is
 * based on the browsers preferences (the 'accept-languages' HTTP header.
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
var angularTranslateI18nextAdapterPre = function(req,res,next) {
    if (req.headers['yp-language']) {
        req.headers['cookie'] = 'i18next='+ req.headers['yp-language'];
    }
    return next();
};

var angularTranslateI18nextAdapterPost = function(req,res,next) {
    res.setHeader('yp-language', req.locale);
    return next();
};

var initialize = function initialize () {
    i18n.init({
        fallbackLng: 'de',
        supportedLngs: ['de','en', 'fr', 'it'],
        ns: {
            namespaces: ['email', 'ical']
        },
        resGetPath: 'translations/__ns__.__lng__.json',
        saveMissing: false,
        debug: false});
    return i18n;
};

module.exports = {
    angularTranslateI18nextAdapterPre: angularTranslateI18nextAdapterPre,
    angularTranslateI18nextAdapterPost: angularTranslateI18nextAdapterPost,
    initialize: initialize
};