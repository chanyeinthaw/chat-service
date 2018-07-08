class ClientRepository {
    constructor() {
        this._clients = {}
    }

    static addClient(client) {
        let instance = this.getInstance()

        if (!instance._clients.hasOwnProperty(client.socketId))
            instance._clients[client.socketId] = client
    }

    static getClient(socket) {
        let instance = this.getInstance()
        if (typeof socket === 'string')
            return instance._clients.hasOwnProperty(socket) ? instance._clients[socket] : null
        else
            return socket.hasOwnProperty('id') ? (instance._clients.hasOwnProperty(socket.id) ? instance._clients[socket.id] : null) : null
    }

    static removeClient(socketId) {
        let instance = this.getInstance()
        if (instance._clients.hasOwnProperty(socketId)) delete instance._clients[socketId]
    }

    static getInstance() {
        if (!this.instance)
            this.instance = new ClientRepository()

        return this.instance
    }
}

ClientRepository.instance = null

module.exports = ClientRepository