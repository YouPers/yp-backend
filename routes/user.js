/**
 * User Routes module
 *    these routes require authenticated users
 */

var mongoose = require('mongoose'),
    User = mongoose.model('User');
//    ObjectId = mongoose.Types.ObjectId;


module.exports = function (app, config) {

    var getUser = function (req, res, next) {
        User.find().exec(function (err, users) {
                if (err) {
                    return next(err);
                }
                res.send(users);
                return next();

            }
        );
    };

    var postUser = function (req, res, next) {

        var newUser = new User(req.body);

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
        User.remove(function(err) {
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
    app.get('/api/v1/user', getUser);

    /**
     * Post new user
     *
     * @param path
     * @param post a user
     */
    app.post('/api/v1/user', postUser);


    /**
     * Post new user
     *
     * @param path
     * @param post a user
     */
    app.del('/api/v1/user', deleteUser);

};