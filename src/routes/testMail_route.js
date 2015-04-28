var error = require('ypbackendlib').error,
    moment = require('moment'),
    dailySummaryMail = require('../batches/dailySummaryMail'),
    campaignLeadSummaryMail = require('../batches/campaignLeadSummaryMail');

module.exports = function (swagger) {


    var dailySummaryUrl = '/dailySummaryMail';
    var campaignLeadSummaryUrl = '/campaignLeadSummaryMail';

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
            "nickname": "getDailySummaryMail",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();
            var lastSentMailDate = req.params.lastSentMailDate ? moment(req.params.lastSentMailDate) : currentDate.subtract(1, 'days');

            dailySummaryMail.renderMail(user, lastSentMailDate.toDate(), currentDate.toDate(), req, function (err, html) {

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
            path: dailySummaryUrl,
            summary: "send daily summary",
            method: "POST",
            params: [
                swagger.queryParam("lastSentMailDate", "start of the date range, the summary is created for, defaults to one day before now", "string"),
                swagger.queryParam("currentDate", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "sendDailySummaryMail",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user; // TODO: select user for admin mode by path parameter

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();
            var lastSentMailDate = req.params.lastSentMailDate ? moment(req.params.lastSentMailDate) : currentDate.subtract(1, 'days');

            dailySummaryMail.sendMail(user, lastSentMailDate, currentDate, function (err) {

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


    swagger.addOperation({
        spec: {
            description: "get campaign lead summary for user",
            path: campaignLeadSummaryUrl,
            summary: "get campaign lead summary",
            method: "GET",
            params: [swagger.queryParam("currentDate", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "getCampaignLeadSummaryMail",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user;

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();

            campaignLeadSummaryMail.renderMail(user, currentDate.toDate(), req, function (err, html) {

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
            description: "send campaign lead summary to user",
            path: campaignLeadSummaryUrl,
            summary: "send campaign lead summary",
            method: "POST",
            params: [
                swagger.queryParam("currentDate", "end of the date range, the summary is created for, defaults to now", "string")
            ],
            "nickname": "sendCampaignLeadSummaryMail",
            accessLevel: 'al_user'
        },
        action: function (req, res, next) {

            var user = req.user;

            var currentDate = req.params.currentDate ? moment(req.params.currentDate) : moment();

            campaignLeadSummaryMail.sendMail(user, currentDate, function (err) {

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