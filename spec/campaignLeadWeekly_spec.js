describe('Send Summary Email', function () {
    var config = require('../src/config/config');
    var ypbackendlib = require('ypbackendlib');
    var log = ypbackendlib.log(config);
    var mongoose = ypbackendlib.mongoose,
        moment = require('moment'),
        mailBatch = require('../src/batches/campaignLeadSummaryMail'),
        _ = require('lodash');


    describe('sendOfferToday', function () {

        it("should return false on a campaign started Monday if it is any day before that Monday", function () {
            var monday = moment().startOf('day').isoWeekday(1).add(1, 'week');
            var sunday = moment(monday).subtract(1, 'day');
            var saturday = moment(monday).subtract(2, 'day');
            var friday = moment(monday).subtract(3, 'day');

            expect(mailBatch.sendOfferToday(monday.toDate(), sunday.toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), saturday.toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), friday.toDate())).toBe(false);
        });

        it("should work for a campaign started on a Monday", function () {
            var monday = moment().startOf('day').isoWeekday(1).add(1, 'week');
            var tuesday = moment(monday).hour(10).minute(15).add(1, 'day');

            expect(mailBatch.sendOfferToday(monday.toDate(), tuesday.toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).subtract(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(2, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(3, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(4, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(5, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(6, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(7, 'day').toDate())).toBe(1);
            expect(mailBatch.sendOfferToday(monday.toDate(), moment(tuesday).add(8, 'day').toDate())).toBe(false);
        });

        it("should work for a campaign started on Thursday", function () {
            var startDate = moment().startOf('day').isoWeekday(4).add(1, 'week');
            var friday1215 = moment(startDate).hour(10).minute(15).add(1, 'day');

            expect(mailBatch.sendOfferToday(startDate.toDate(), friday1215.toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).subtract(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(2, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(3, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(4, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(5, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(6, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(7, 'day').toDate())).toBe(1);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(8, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(9, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(10, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(friday1215).add(14, 'day').toDate())).toBe(2);
        });


        it("should work for a campaign started on Friday", function () {
            var startDate = moment().startOf('day').isoWeekday(5).add(1, 'week');
            var saturday1215 = moment(startDate).hour(10).minute(15).add(1, 'day');

            expect(mailBatch.sendOfferToday(startDate.toDate(), saturday1215.toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).subtract(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(2, 'day').toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(3, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(4, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(5, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(6, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(7, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(8, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(9, 'day').toDate())).toBe(1);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(saturday1215).add(10, 'day').toDate())).toBe(false);
        });


        it("should work for a campaign started on Saturday", function () {
            var startDate = moment().startOf('day').isoWeekday(6).add(1, 'week');
            var sunday1215 = moment(startDate).hour(10).minute(15).add(1, 'day');

            expect(mailBatch.sendOfferToday(startDate.toDate(), sunday1215.toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).subtract(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(1, 'day').toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(2, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(3, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(4, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(5, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(6, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(7, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(8, 'day').toDate())).toBe(1);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(9, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(sunday1215).add(10, 'day').toDate())).toBe(false);
        });

        it("should work for a campaign started on Sunday", function () {
            var startDate = moment().startOf('day').isoWeekday(6).add(1, 'week');
            var monday1215 = moment(startDate).hour(10).minute(15).add(1, 'day');

            expect(mailBatch.sendOfferToday(startDate.toDate(), monday1215.toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).subtract(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(1, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(2, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(3, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(4, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(5, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(6, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(7, 'day').toDate())).toBe(0);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(8, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(9, 'day').toDate())).toBe(false);
            expect(mailBatch.sendOfferToday(startDate.toDate(), moment(monday1215).add(10, 'day').toDate())).toBe(false);
        });

    });
});