var mongoose = require('ypbackendlib').mongoose,
    Idea = mongoose.model('Idea'),
    ActivityManagement = require('../core/ActivityManagement'),
    _ = require('lodash'),
    auth = require('ypbackendlib').auth,
    error = require('ypbackendlib').error,
    handlerUtils = require('ypbackendlib').handlerUtils,
    generic = require('ypbackendlib').handlers;


function _checkIdeaWritePermission(sentIdea, user, cb) {


    // if no author delivered set to authenticated user
    if (!sentIdea.author) {
        sentIdea.author = user.id;
    }

    if (_.contains(user.roles, auth.roles.productadmin)) {
        // requesting user is a product admin
        return cb();

    } else {
        // requesting user is a campaignlead or orgadmin
        if (!sentIdea.campaign) {
            return cb(new error.MissingParameterError('expected idea to have a campaign id', {required: 'campaign id'}));
        }

        if (!user.campaign || user.campaign.id !== sentIdea.campaign) {
            return cb(new error.NotAuthorizedError('you may not post an idea for another campaign, only your own.', {ownCampaign: user.campaign, ideaCampaing: sentIdea.campaign}));
        }

        sentIdea.source = "campaign";
        return cb();
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
        return next(new error.NotAuthorizedError({author: sentIdea.author, user: req.user.id}));
    }


    _checkIdeaWritePermission(sentIdea, req.user, function (err) {
        if (err) {
            return error.handleError(err, next);
        }

        // split instnciating of doc from setting of attributes,
        // we need to set the $locale, so it is accessible in virtuals
        var newIdea = new Idea();
        newIdea.$locale = req.locale;
        newIdea.set(sentIdea);

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
                return next(new error.ResourceNotFoundError({id: sentIdea.id}));
            }

            reloadedIdea.$locale = req.locale;

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
            finder = {
                $or: [
                    {campaign: null},
                    {campaign: req.params.campaign}
                ]
            };
        } else if (req.params.filter && req.params.filter.id) {
            // if we have a filter for concrete idea-id we allow to get all ideas regardless of campaign attribute
        } else {
            // do not deliver ideas from foreign campaigns.
            finder = {campaign: null};
        }

        var dbQuery = Model.find(finder);

        if (req.params.topic) {
            dbQuery.and({topics: req.params.topic});
        }

        generic.addStandardQueryOptions(req, dbQuery, Model)
            .exec(generic.sendListCb(req, res, next));
    };
}

function getDefaultActivity(req, res, next) {
    Idea.findById(req.params.id).select(Idea.getI18nPropertySelector(req.locale)).exec(function (err, idea) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!idea) {
            return next(new error.ResourceNotFoundError());
        }

        var defaultActivity = ActivityManagement.defaultActivity(idea, req.user, req.params.campaignId);
        req.log.debug(defaultActivity);
        defaultActivity._id = undefined;
        res.send(defaultActivity);
        return next();
    });
}

module.exports = {
    postIdea: postIdea,
    putIdea: putIdea,
    getAllIdeas: getAllIdeas,
    getDefaultActivity: getDefaultActivity
};