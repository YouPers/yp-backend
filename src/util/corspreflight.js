module.exports = function (server) {
    server.use(function (req, res, next) {
        if (req.headers.origin) {
            res.header('Access-Control-Allow-Origin', req.headers.origin);
        }
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Headers', 'X-Requested-With, Cookie, Set-Cookie, Accept, ' +
            'Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization, yp-language');
        res.header('Access-Control-Expose-Headers', 'Set-Cookie');
        res.header('Access-Control-Max-Age', '3000');
        return next();
    });
    return server.opts('.*', function (req, res, next) {
        if (req.headers.origin && req.headers['access-control-request-method']) {
            res.header('Access-Control-Allow-Origin', req.headers.origin);
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, Cookie, Set-Cookie, Accept, ' +
                'Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization, yp-language');
            res.header('Access-Control-Expose-Headers', 'Set-Cookie', 'Language');
            res.header('Allow', req.headers['access-control-request-method']);
            res.header('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
            res.header('Access-Control-Max-Age', '3000');
            if (req.log) {
                req.log.debug({
                    url: req.url,
                    method: req.headers['access-control-request-method']
                }, "Preflight");
            }
            res.send(204);
            return next();
        } else {
            res.send(404);
            return next();
        }
    });
};