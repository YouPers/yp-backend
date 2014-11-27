var error = require('ypbackendlib').error,
    moment = require('moment'),
    eventsSummaryMail = require('../batches/eventsSummaryMail');

module.exports = function (swagger) {


    var dailySummaryUrl = '/dailySummary';
    var sendDailySummaryUrl = '/sendDailySummary';

    swagger.addOperation({
        spec: {
            description: "get daily summary for user",
            path: dailySummaryUrl,
            summary: "get daily summary",
            method: "GET",
            params: [
                swagger.queryParam("rangeStart", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.queryParam("rangeEnd", "end of the date range, the summary is created for, defaults to now", "string")
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
    swagger.addOperation({
        spec: {
            description: "send daily summary to user",
            path: sendDailySummaryUrl,
            summary: "get daily summary",
            method: "POST",
            params: [
                swagger.queryParam("rangeStart", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.queryParam("rangeEnd", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "sendDailySummary",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var rangeEnd = req.params.rangeEnd ? moment(req.params.rangeEnd) : moment();
            var rangeStart = req.params.rangeStart ? moment(req.params.rangeStart) : rangeEnd.subtract(1, 'days');

            eventsSummaryMail.sendSummaryMail(user, rangeStart, rangeEnd, function (err) {

                if (err) {
                    return error.handleError(err, next);
                }
                res.send(200);
                return next();

            }, { // context
                i18n: req.i18n,
                log: req.log
            });


        }
    });
};