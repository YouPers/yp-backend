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
                swagger.queryParam("lastSentMailDate", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.queryParam("currentDate", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "getDailySummary",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();
            var lastSentMailDate = req.params.lastSentMailDate ? moment(req.params.lastSentMailDate) : currentDate.subtract(1, 'days');
            
            eventsSummaryMail.renderSummaryMail(user, lastSentMailDate.toDate(), currentDate.toDate(), req, function (err, html) {

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
                swagger.queryParam("lastSentMailDate", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.queryParam("currentDate", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "sendDailySummary",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();
            var lastSentMailDate = req.params.lastSentMailDate ? moment(req.params.lastSentMailDate) : currentDate.subtract(1, 'days');

            eventsSummaryMail.sendSummaryMail(user, lastSentMailDate, currentDate, function (err) {

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