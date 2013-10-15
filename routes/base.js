/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 15.10.13
 * Time: 09:12
 * To change this template use File | Settings | File Templates.
 */
var  mongoose = require('mongoose');

module.exports = function (app, config) {

    /**
     * Ping the API server
     * Kind of pointless since the server has to be up to even respond, but demonstrates most basic API
     *
     * @param path
     * @param request
     * @param response
     */
    app.get('/api', function (req, res) {
        res.send({'message':'Success'});
    });



    /**
     * Ping the Database server
     * A little more useful than the ping API
     *
     * I looked at header based API versioning, not a fan, but also when I tried this, the atatic resource GETs hang
     *   app.get({path : '/db', version : '1.0.0'}, ...
     *   app.get({path : '/db', version : '2.0.0'}, ...
     *
     * @param path
     * @param request
     * @param response
     */
    app.get('/db', function (req, res) {
        var result = '';
        mongoose.connection.db.executeDbCommand({'ping':'1'}, function(err, dbres) {
            if (err === null) {
                res.send(dbres);
            } else {
                res.send(err);
            }
        });
    });



}


