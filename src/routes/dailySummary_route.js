var error = require('ypbackendlib').error,
    moment = require('moment'),
    eventsSummaryMail = require('../batches/eventsSummaryMail');

module.exports = function (swagger) {


    var url = '/dailySummary';

    swagger.addOperation({
        spec: {
            description: "get daily summary for user",
            path: url,
            summary: "get daily summary",
            method: "GET",
            params: [
                swagger.pathParam("rangeStart", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.pathParam("rangeEnd", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "getDailySummary",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var rangeEnd = req.params.rangeEnd ? moment(req.params.rangeEnd) : moment();
            var rangeStart = req.params.rangeStart ? moment(req.params.rangeStart) : rangeEnd.subtract(1, 'days');
            
            eventsSummaryMail.renderSummaryMail(user, rangeStart.toDate(), rangeEnd.toDate(), req.i18n, function (err, html) {

                if (err) {
                    return error.handleError(err, next);
                }

                res.send(html);
                return next();
            });

            
        }
    });
};