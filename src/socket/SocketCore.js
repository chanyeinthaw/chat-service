const SocketIO = require('socket.io')
const config = require('getconfig')
class SocketCore {
    constructor(server) {
        this._clients = {}
        this._server = SocketIO(server)
    }

    get server() {
        return this._server
    }

    onConnection(handler) {
        this._server.on('connection', handler)
    }

    addClient(client) {
        if (!this._clients.hasOwnProperty(client.socketId))
            this._clients[client.socketId] = client
    }

    getClient(socket) {
        if (typeof socket === 'string')
            return this._clients.hasOwnProperty(socket) ? this._clients[socket] : null
        else
            return socket.hasOwnProperty('id') ? (this._clients.hasOwnProperty(socket.id) ? this._clients[socket.id] : null) : null
    }

    removeClient(socketId) {
        if (this._clients.hasOwnProperty(socketId)) delete this._clients[socketId]
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
        return this._server.sockets.clients(name).length
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