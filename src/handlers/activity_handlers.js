var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity'),
    Campaign = mongoose.model('Campaign'),
    _ = require('lodash'),
    auth = require('../util/auth'),
    error = require('../util/error'),
    handlerUtils = require('./handlerUtils');


function _checkActivityWritePermission(sentActivity, user, cb) {


    // if no author delivered set to authenticated user
    if (!sentActivity.author) {
        sentActivity.author = user.id;
    }

    if (_.contains(user.roles, auth.roles.productadmin)) {
        // requesting user is a product admin
        return cb();

    } else if (_.contains(user.roles, auth.roles.orgadmin) || _.contains(user.roles, auth.roles.campaignlead)) {
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
            if (!_.contains(campaign.campaignLeads.toString(), user.id)) {
                return cb(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                    userId: user.id,
                    campaignId: campaign.id
                }));
            }
            sentActivity.source = "campaign";
            // everything is fine -->
            return cb();
        });


    } else {
        return cb(new error.NotAuthorizedError('POST of object only allowed if author is an org admin, campaign lead or productAdmin',
            { user: user.id}));
    }
}

function _removeEmptyRecWeights(sentActivity) {
    if (_.isArray(sentActivity.recWeights)) {
        _.remove(sentActivity.recWeights, function (recWeight) {
            return (_.isNull(recWeight[1]) || _.isUndefined(recWeight[1] || recWeight[1] === 0)) &&
                (_.isNull(recWeight[2]) || _.isUndefined(recWeight[2] || recWeight[1] === 0));
        });
    }
}

function postActivity(req, res, next) {

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
    }

    var sentActivity = req.body;

    handlerUtils.cleanPopulated(Activity, sentActivity);

    _removeEmptyRecWeights(sentActivity);

    // check whether delivered author is the authenticated user
    // only to be checkt for POST becuase in PUT it is allowed to update an activitiy that has been authored by
    // somebody else.
    if (sentActivity.author && (req.user.id !== sentActivity.author)) {
        return next(new error.NotAuthorizedError({ author: sentActivity.author, user: req.user.id}));
    }


    _checkActivityWritePermission(sentActivity, req.user, function (err) {
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

    if (!req.body) {
        return next(new error.MissingParameterError({ required: 'activity object' }));
    }

    var sentActivity = req.body;
    handlerUtils.cleanPopulated(Activity, sentActivity);

    _removeEmptyRecWeights(sentActivity);

    _checkActivityWritePermission(sentActivity, req.user, function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        Activity.findById(req.params.id).exec(function (err, reloadedActivity) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!reloadedActivity) {
                return next(new error.ResourceNotFoundError({ id: sentActivity.id}));
            }

            _.extend(reloadedActivity, sentActivity);

            // try to save the new object
            reloadedActivity.save(function (err) {
                if (err) {
                    return error.handleError(err, next);
                }

                res.send(200, reloadedActivity);
                return next();
            });
        });
    });

}

module.exports = {
    postActivity: postActivity,
    putActivity: putActivity
};