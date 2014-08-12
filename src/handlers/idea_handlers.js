var mongoose = require('mongoose'),
    Idea = mongoose.model('Idea'),
    ActivityManagement = require('../core/ActivityManagement'),
    Campaign = mongoose.model('Campaign'),
    _ = require('lodash'),
    auth = require('../util/auth'),
    error = require('../util/error'),
    handlerUtils = require('./handlerUtils'),
    generic = require('./generic'),
    async = require('async'),
    SocialInteraction = require('../core/SocialInteraction');


function _checkIdeaWritePermission(sentIdea, user, cb) {


    // if no author delivered set to authenticated user
    if (!sentIdea.author) {
        sentIdea.author = user.id;
    }

    if (_.contains(user.roles, auth.roles.productadmin)) {
        // requesting user is a product admin
        return cb();

    } else if (_.contains(user.roles, auth.roles.orgadmin) || _.contains(user.roles, auth.roles.campaignlead)) {
        // requesting user is a campaignlead or orgadmin
        if (!sentIdea.campaign) {
            return cb(new error.MissingParameterError('expected idea to have a campaign id', { required: 'campaign id' }));
        }

        Campaign.findById(sentIdea.campaign).exec(function (err, campaign) {
            if (err) {
                return error.handleError(err, cb);
            }

            if (!campaign) {
                return cb(new error.ResourceNotFoundError('Campaign not found.', { id: sentIdea.campaign }));
            }

            // check whether the posting user is a campaignLead of the campaign
            if (!_.contains(campaign.campaignLeads.toString(), user.id)) {
                return cb(new error.NotAuthorizedError('The user is not a campaignlead of this campaign.', {
                    userId: user.id,
                    campaignId: campaign.id
                }));
            }
            sentIdea.source = "campaign";
            // everything is fine -->
            return cb();
        });


    } else {
        return cb(new error.NotAuthorizedError('POST of object only allowed if author is an org admin, campaign lead or productAdmin',
            { user: user.id}));
    }
}

function _removeEmptyRecWeights(sentIdea) {
    if (_.isArray(sentIdea.recWeights)) {
        _.remove(sentIdea.recWeights, function (recWeight) {
            return (_.isNull(recWeight[1]) || _.isUndefined(recWeight[1] || recWeight[1] === 0)) &&
                (_.isNull(recWeight[2]) || _.isUndefined(recWeight[2] || recWeight[1] === 0));
        });
    }
}

function postIdea(req, res, next) {

    var sentIdea = req.body;

    var err = handlerUtils.checkWritingPreCond(sentIdea, req.user, Idea);
    if (err) {
        return error.handleError(err, next);
    }

    _removeEmptyRecWeights(sentIdea);

    // check whether delivered author is the authenticated user
    // only to be checked for POST because in PUT it is allowed to update an idea that has been authored by
    // somebody else.
    if (sentIdea.author && (req.user.id !== sentIdea.author)) {
        return next(new error.NotAuthorizedError({ author: sentIdea.author, user: req.user.id}));
    }


    _checkIdeaWritePermission(sentIdea, req.user, function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        var newIdea = new Idea(sentIdea);

        // try to save the new object
        newIdea.save(generic.writeObjCb(req, res, next));
    });
}


function putIdea(req, res, next) {

    var sentIdea = req.body;

    var err = handlerUtils.checkWritingPreCond(sentIdea, req.user, Idea);
    if (err) {
        return error.handleError(err, next);
    }

    _removeEmptyRecWeights(sentIdea);

    _checkIdeaWritePermission(sentIdea, req.user, function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        Idea.findById(req.params.id).exec(function (err, reloadedIdea) {
            if (err) {
                return error.handleError(err, next);
            }
            if (!reloadedIdea) {
                return next(new error.ResourceNotFoundError({ id: sentIdea.id}));
            }

            _.extend(reloadedIdea, sentIdea);

            // try to save the new object
            reloadedIdea.save(generic.writeObjCb(req, res, next));
        });
    });

}


function getAllIdeas(baseUrl, Model) {
    return function (req, res, next) {
        var finder = '';

        if (req.params.campaign) {
            finder = {$or: [
                {campaign: null},
                {campaign: req.params.campaign}
            ]};
        } else {
            finder = {campaign: null};
        }

        var dbQuery = Model.find(finder);

        generic.addStandardQueryOptions(req, dbQuery, Model)
            .exec(generic.sendListCb(req, res, next));
    };
}

function getDefaultActivity(req, res, next) {
    Idea.findById(req.params.id).exec(function (err, idea) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!idea) {
            return next(new error.ResourceNotFoundError());
        }

        var defaultActivity = ActivityManagement.defaultActivity(idea, req.user);
        req.log.info(defaultActivity);
        defaultActivity._id = undefined;
        res.send(defaultActivity);
        return next();
    });
}


function getIdeaUserContext(req, res, next) {
    var ideaId = req.params.id;
    if (!ideaId) {
        return next(new error.MissingParameterError('id of idea is required'));
    }
    var ctx = {};

    function _loadIdea(done) {
        Idea.findById(ideaId).exec(function (err, idea) {
            if (err) {
                return done(err);
            }
            if (!idea) {
                return done(new error.ResourceNotFoundError('idea not found'));
            }
            ctx.idea = idea;
            return done();
        });
    }

    function _loadActivities(done) {
        var userClause = { $or: [
            { owner: req.user._id },
            { joiningUsers: req.user._id }
        ]};
        mongoose.model('Activity')
            .find({idea: ideaId})
            .where(userClause)
            .populate('owner joiningUsers')
            .exec(function (err, activities) {
                if (err) {
                    return done(err);
                }
                ctx.activities = activities;
                return done();
            });
    }

    function _loadSocialInteractions(done) {

        var queryOptions = req.query;
        queryOptions.populate = req.query.populate ? 'author ' + req.query.populate : 'author';

        var options = {
            refDocId: ideaId,
            locale: req.locale,
            queryOptions: queryOptions,
            adminMode: false
        };

        SocialInteraction.getAllForUser(req.user, mongoose.model('SocialInteraction'), options, function (err, sois) {
            if (err) {
                return done(err);
            }
            ctx.socialInteractions = _.groupBy(sois, '__t');
            return done();
        });
    }

    function _loadEvents(done) {
        mongoose.model('ActivityEvent').find({owner: req.user._id, idea: ideaId}).exec(function (err, events) {
            if (err) {
                return done(err);
            }
            ctx.events = events;
            return done();
        });
    }

    async.parallel([_loadIdea, _loadActivities, _loadSocialInteractions, _loadEvents],
        function (err) {
            if (err) {
                return error.handleError(err, next);
            }
            res.send(ctx);
            return next();
        });
}

module.exports = {
    postIdea: postIdea,
    putIdea: putIdea,
    getAllIdeas: getAllIdeas,
    getDefaultActivity: getDefaultActivity,
    getUserContextByIdFn: getIdeaUserContext
};