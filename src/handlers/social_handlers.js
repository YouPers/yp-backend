var error = require('../util/error'),
    async = require('async'),
    mongoose = require('mongoose'),
    CommentModel = mongoose.model('Comment'),
    ActivityPlanModel = mongoose.model('ActivityPlan'),
    _ = require('lodash');

/**
 * sends a list of currently relevant social events for the authenticated user.
 * Current Implementation:
 * 1. get all Public comments
 * 2. get all joinOffers public and in the same campaign(s) as the current user.
 * 3. sort by createdDate decreasing
 * 4. return first n objects.
 *
 * @param baseUrl
 * @param Model
 * @returns {Function}
 */
var getListFn = function getSocialEventsListFn(baseUrl, Model) {
    return function (req, res, next) {
        var locals = {};

        if (!req.user) {
            return next(new error.MissingParameterError({ required: 'user' }));
        }

        async.parallel([
            // load comments
            function (done) {
                var q = CommentModel.find()
                    .sort('-created')
                    .populate('author')
                    .limit(req.params.limit || 10);
                if (req.user.campaign) {
                    q.where('campaign').equals(req.user.campaign.id || req.user.campaign);
                } else {
                    q.where('campaign').equals(null);
                }

                q.exec(function (err, comments) {
                    if (err) {
                        return done(err);
                    }
                    locals.comments = comments;
                    return done();
                });
            },
            // load joinOffers
            function (done) {
                var q = ActivityPlanModel.find().sort('-mainEvent.start').populate('activity').populate('owner');

                // only show Plans that are for groups
                q.where('executionType').equals('group');
                // only if visibility is not private
                q.where('visibility').ne('private');
                // do not show my own plans
                q.where('owner').ne(req.user.id);
                // only show plans that are from the same campaign as I am currently participating in
                if (req.user.campaign) {
                    q.or([
                        {'campaign': req.user.campaign.id || req.user.campaign},
                        {'campaign': null, visibility: 'public'}
                    ]);
                } else {
                    q.and([{'campaign': null},{visibility: 'public'}]);
                }

                // only show masterPlans
                q.where('masterPlan').equals(null);

                q.limit(req.params.limit || 10);


                q.exec(function (err, actPlans) {
                    if (err) {
                        return done(err);
                    }

                    locals.actPlans = _.map(actPlans, function (actPlan) {
                        return {
                            author: actPlan.owner,
                            created: actPlan.mainEvent.start,
                            refDoc: actPlan._id,
                            refDocModel: 'ActivityPlan',
                            refDocTitle: actPlan.activity.number + ": " + actPlan.activity.title,
                            refDocLink: "/activities/" + actPlan.activity._id,
                            text: "Mache mit bei unserer Gruppen-Aktivität"
                        };
                    });

                    return done();
                });
            }
        ],
            // executed when both DB calls are done and data is ready
            function (err) {
                if (err) {
                    return error.handleError(err, next);
                }

                var events = _.sortBy(locals.comments.concat(locals.actPlans), function (obj) {
                    return -obj.created;
                });

                res.send(events);
                return next();
            });

    };
};


module.exports = {
    getListFn: getListFn
};