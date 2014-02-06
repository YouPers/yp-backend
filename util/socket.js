
var socketio = require('socket.io');
var io;

var socketServer = function(server) {

    io = socketio.listen(server);

    io.sockets.on('connection', function (s) {
        console.log("connection: " + s);
    });
};

var send = function (eventName, message) {
    io.sockets.emit(eventName, message);
};

module.exports = {
    send: send,
    socketServer: socketServer
};