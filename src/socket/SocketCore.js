const SocketIO = require('socket.io')
const config = require('getconfig')
class SocketCore {
    constructor(server) {
        this._server = SocketIO(server)
    }

    get server() {
        return this._server
    }

    getClientById(id) {
        return this._server.sockets.connected[id]
    }

    onConnection(handler) {
        this._server.on('connection', handler)
    }

    setEventHandler(event, handler) {
        this._server.on(event, handler)
    }

    broadcastToRoom(room, event, data) {
        this._server.sockets.in(room).emit(event, data)
    }

    broadcast(event, data) {
        this._server.sockets.emit(event, data)
    }

    getNumberOfClients() {
        return this._server.sockets.sockets.length
    }

    getNumberOfClientsInRoom(name) {
        let clients = this._server.sockets.adapter.rooms[name]
        return clients ? clients.length : 0
    }

    static initSockets(server, isSecure, connectionHandler) {
        let secureSocket = null
        let unsecureSocket = null

        if (isSecure) {
            secureSocket = new SocketCore(server.serverSecure)
            secureSocket.onConnection(connectionHandler.bind(secureSocket))
        }

        unsecureSocket = new SocketCore(server.serverUnsecure)
        unsecureSocket.onConnection(connectionHandler.bind(unsecureSocket))
    }
}

module.exports = SocketCore