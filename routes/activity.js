/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 15.10.13
 * Time: 17:08
 * To change this template use File | Settings | File Templates.
 */
/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    Activity = mongoose.model('Activity');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var getActivities = function (req, res, next) {
        Activity.find().exec(function (err, activities) {
                if (err) {
                    return next(err);
                }
                res.send(activities);
                return next();
            }
        );
    };

    var postUser = function (req, res, next) {

        var newUser = new Activity(req.body);

        newUser.save(function (err) {
            if (err) {
                console.log(err);
                err.statusCode = 409;
                return next(err);
            }
            res.header('location','balbal');
            res.send(201);
            return next();
        });

    };

    var deleteUser = function(req,res,next) {
        Activity.remove(function(err) {
            if (err) {
                return  next(err);
            }
            res.send(200);
        });
    };

    /**
     * Get all users
     *
     * @param path
     * @param callback searches for users
     */
    app.get('/api/v1/activities', getActivities);

    /**
     * Post new user
     *
     * @param path
     * @param post a user
     */
    app.post('/api/v1/activity', postUser);


    /**
     * Post new user
     *
     * @param path
     * @param post a user
     */
    app.del('/api/v1/activity', deleteUser);

};