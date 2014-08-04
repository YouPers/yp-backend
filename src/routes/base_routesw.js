/**
 * Created with IntelliJ IDEA.
 * User: retoblunschi
 * Date: 15.10.13
 * Time: 09:12
 * To change this template use File | Settings | File Templates.
 */
var  mongoose = require('mongoose');

module.exports = function (swagger, config) {

    /**
     * Ping the API server
     * Kind of pointless since the server has to be up to even respond, but demonstrates most basic API
     */
    swagger.addOperation({
        spec: {
            description: "Basic Operations to test connection and availability of API and Database",
            path: '/ping',
            notes: "returns {message: Success} as json",
            summary: "checks basic availability of api, return code 200 if api is available.",
            method: "GET",
            "nickname": "ping",
            accessLevel: 'al_all'
        },
        action: function (req, res, next) {
            res.send({'message':'Success'});
            return next();
        }
    });


    /**
     * Ping the Database server
     * A little more useful than the ping API
     *
     * @param path
     * @param request
     * @param response
     */
    swagger.addOperation({
        spec: {
            description: "Basic Operations to test connection and availability of API and Database",
            path: '/ping/db',
            notes: "returns some database information as json",
            summary: "checks basic availability of database, return code 200 if db is available.",
            method: "GET",
            "nickname": "pingdb",
            accessLevel: 'al_all'
        },
        action: function (req, res, next) {
            mongoose.connection.db.executeDbCommand({'ping':'1'}, function(err, dbres) {
                if (err === null) {
                    res.send(dbres);
                    return next();
                } else {
                    res.send(err);
                    return next(err);
                }
            });}
    });
};