class ClientRepository {
    constructor() {
        this._clients = {}
    }

    static addClient(client) {
        let instance = this.getInstance()

        if (!instance._client.hasOwnProperty(client.socketId))
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
        return ClientRepository.instance ? ClientRepository.instance : new ClientRepository()
    }
}

ClientRepository.instance = null

module.exports = ClientRepository