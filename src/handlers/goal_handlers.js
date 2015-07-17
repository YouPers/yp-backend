var mongoose = require('ypbackendlib').mongoose,
    Occurence = mongoose.model('Occurence'),
    Goal = mongoose.model('Goal'),
    generic = require('ypbackendlib').handlers,
    error = require('ypbackendlib').error,
    _ = require('lodash'),
    moment = require('moment-timezone'),
    auth = require('ypbackendlib').auth;


function _attachStats(goals, cb) {
    var goalsArray = _.isArray(goals) ? goals : [goals];

    if (goalsArray.length < 1 || !_.isObject(goalsArray[0])) {
        return cb(null, goals);
    }

    if (!goalsArray[0].categories || goalsArray[0].categories.length < 1 || !goalsArray[0].categories[0]._id) {
        return cb(new Error("each goal must have at least one populated category"));
    }

    // load the user's occurences
    Occurence
        .find({owner: goalsArray[0].owner})
        .populate('idea')
        .exec(function (err, occurences) {
            if (err) {
                return cb(err);
            }
            _.forEach(goalsArray, function (goal) {

                // count for the goal the occurences that occur within this and last goal period and have at least
                // one matching category
                goal.thisPeriodCount = _.filter(occurences, function (occ) {
                    return _hasMatchingCategory(goal, occ) && _hasMatchingDate(goal, occ, 0);
                }).length;

                goal.lastPeriodCount = _.filter(occurences, function (occ) {
                    return _hasMatchingCategory(goal, occ) && _hasMatchingDate(goal, occ, -1);
                }).length;


            });

            return cb(null, goals);
        });
}

function _hasMatchingCategory(goal, occ) {
    return _(goal.categories)
        .map('key')
        .intersection(occ.idea.categories)
        .first();
}


function _hasMatchingDate(goal, occ, period) {
    period = period ? period : 0;

    var periodMoment = moment().add(period, goal.timeFrame);
    return moment(occ.start).isSame(periodMoment, goal.timeFrame);
}

function getGoalById(req, res, next) {

    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    }
    if (!req.params || !req.params.id) {
        return next(new error.MissingParameterError('Goal Id is required'));
    }

    var dbQuery = Goal.findById(req.params.id);
    if (req.params.stats) {
        dbQuery.populate('categories');
    }

    var op = generic.addStandardQueryOptions(req, dbQuery, Goal);
    op.exec(function (err, goals) {
        if (!err && req.params.stats) {
            return _attachStats(goals, generic.sendListCb(req, res, next));
        } else {
            return generic.writeObjCb(req, res, next)(err, goals);
        }
    });
}


function getGoals(req, res, next) {

    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    }
    var finder = {
        owner: req.user._id
    };

    var dbQuery = Goal.find(finder);
    if (req.params.stats) {
        dbQuery.populate('categories');
    }

    var op = generic.addStandardQueryOptions(req, dbQuery, Goal);
    op.exec(function (err, goals) {
        if (!err && req.params.stats) {
            return _attachStats(goals, generic.sendListCb(req, res, next));
        } else {
            return generic.sendListCb(req, res, next)(err, goals);
        }
    });

}

function deleteGoalById(req, res, next) {
    var objId;
    try {
        objId = new mongoose.Types.ObjectId(req.params.id);
    } catch (err) {
        return next(new error.InvalidArgumentError({id: req.params.id}));
    }
    // instead of using Model.remove directly, findOne in combination with obj.remove
    // is used in order to trigger
    // - schema.pre('remove', ... or
    // - schema.pre('remove', ...
    // see user_model.js for an example

    var finder = {_id: objId};
    if (!req.user || !req.user.id) {
        return next(new error.NotAuthorizedError('Authentication required for this object'));
    } else if (!auth.checkAccess(req.user, 'al_systemadmin')) {
        finder.owner = req.user.id;
    } else {
        // user is systemadmin, he may delete all
    }

    Goal.findOne(finder).exec(function (err, goal) {
        if (err) {
            return error.handleError(err, next);
        }
        if (!goal) {
            req.log.error(finder);
            return next(new error.ResourceNotFoundError());
        }
        if (req.params.realdelete) {
            goal.remove(function (err) {
                if (err) {
                    return next(err);
                }
                res.send(200);
                return next();
            });
        } else {
            goal.end = new Date();
            goal.save(function(err, saved) {
                if (err) {
                    return next(err);
                }
                res.send(200);
                return next();
            });
        }
    });
}

module.exports = {
    getGoalById: getGoalById,
    getGoals: getGoals,
    deleteGoalById: deleteGoalById
};