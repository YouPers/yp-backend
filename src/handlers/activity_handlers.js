var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    Campaign = mongoose.model('Campaign'),
    _ = require('lodash'),
    auth = require('../util/auth'),
    error = require('../util/error'),
    handlerUtils = require('./handlerUtils');

function postActivity(req, res, next) {

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
    }

    var sentActivity = req.body;

    handlerUtils.cleanPopulated(Activity, sentActivity);

    // check whether delivered author is the authenticated user
    if (sentActivity.author && (req.user.id !== sentActivity.author)) {
        return next(new error.NotAuthorizedError({ author: sentActivity.author, user: req.user.id}));
    }

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }

    function checkPermission(cb) {

        if (_.contains(req.user.roles, auth.roles.productadmin)) {
            // requesting user is a product admin
            return cb();

        } else if (_.contains(req.user.roles, auth.roles.orgadmin) || _.contains(req.user.roles, auth.roles.campaignlead)) {
            // requesting user is a campaignlead or orgadmin
            if (!sentActivity.campaign) {
                return cb(new error.MissingParameterError('expected activity to have a campaign id', { required: 'campaign id' }));
            }

            Campaign.findById(sentActivity.campaign).exec(function (err, campaign) {
                if (err) {
                    return error.handleError(err, cb);
                }

                if (!campaign) {
                    return cb(new error.ResourceNotFoundError('Campaign not found.', { id: sentActivity.campaign }));
                }

                // check whether the posting user is a campaignLead of the campaign
                if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                    return cb(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                        userId: req.user.id,
                        campaignId: campaign.id
                    }));
                }
                sentActivity.source = "campaign";
                // everything is fine -->
                return cb();
            });


        } else {
            return cb(new error.NotAuthorizedError('POST of object only allowed if author is an org admin, campaign lead or productAdmin',
                { user: req.user.id}));
        }
    }

    checkPermission(function(err) {
        if (err) {
            return error.handleError(err, next);
        }

        var newActivity = new Activity(sentActivity);

        // try to save the new object
        newActivity.save(function (err) {
            if (err) {
                return error.handleError(err, next);
            }

            res.header('location', '/activities' + '/' + newActivity._id);
            res.send(201, newActivity);
            return next();
        });
    });
}

function putActivity(req, res, next) {

    req.log.trace({parsedReq: req}, 'Put updated Activity');

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
    }

    var sentActivity = req.body;
    req.log.trace({body: sentActivity}, 'parsed req body');

    // ref properties: replace objects by ObjectId in case client sent whole object instead of reference only
    // do this check only for properties of type ObjectID
    _.filter(Activity.schema.paths, function (path) {
        return (path.instance === 'ObjectID');
    })
        .forEach(function (myPath) {
            if ((myPath.path in sentActivity) && (!(typeof sentActivity[myPath.path] === 'string' || sentActivity[myPath.path] instanceof String))) {
                sentActivity[myPath.path] = sentActivity[myPath.path].id;
            }
        });

    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = req.user.id;
    }

    Activity.findById(req.params.id).exec(function (err, reloadedActivity) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!reloadedActivity) {
            return next(new error.ResourceNotFoundError({ id: sentActivity.id}));
        }

        _.extend(reloadedActivity, sentActivity);

        if (_.contains(req.user.roles, auth.roles.productadmin)) {

            // try to save the new object
            reloadedActivity.save(function (err) {
                if (err) {
                    return error.handleError(err, next);
                }

                res.send(200, reloadedActivity);
                return next();
            });

        } else if (!_.contains(req.user.roles, auth.roles.orgadmin) && !_.contains(req.user.roles, auth.roles.campaignlead)) {
            // checks based on roles of requesting user
            return next(new error.NotAuthorizedError('PUT of object only allowed if author is an org admin or a campaign lead', {
                userId: req.user.id
            }));
        } else {
            if (!reloadedActivity.campaign) {
                return next(new error.MissingParameterError('expected activity to have a campaign id', { required: 'campaign id' }));
            } else {

                Campaign.findById(reloadedActivity.campaign).exec(function (err, campaign) {
                    if (err) {
                        return error.handleError(err, next);
                    }
                    if (!campaign) {
                        return next(new error.ResourceNotFoundError('Campaign not found', { id: reloadedActivity.campaign }));
                    }

                    // check whether the posting user is a campaignLead of the campaign
                    if (!_.contains(campaign.campaignLeads.toString(), req.user.id)) {
                        return next(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                            userId: req.user.id,
                            campaignId: campaign.id
                        }));
                    }

                    // orgadmin's and campaignlead's can only manage campaign-specific activities
                    reloadedActivity.source = "campaign";

                    // try to save the new object
                    reloadedActivity.save(function (err) {
                        if (err) {
                            return error.handleError(err, next);
                        }

                        res.header('location', '/api/v1/activities' + '/' + reloadedActivity._id);
                        res.send(201, reloadedActivity);
                        return next();
                    });
                });
            }

        }

    });
}

module.exports = {
    postActivity: postActivity,
    putActivity: putActivity
};