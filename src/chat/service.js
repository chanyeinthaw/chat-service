const SocketCore = require('../socket/SocketCore')
const ChatEndpoint = require('./ChatEndpoint')
const Clients = require('../socket/ClientRepository')

module.exports = (httpServer, database, config, laravel) => {
    SocketCore.initSockets(httpServer, config.secure, function (client) {
        console.log(`CLIENT_CONNECTED id: ${client.id}`)

        Clients.addClient(new SocketClient(client))

        let chatEP = new ChatEndpoint(this, client, database, config.accessKey, laravel)

        chatEP.postAuthHandler = () => {
            // new VChatEndpoint(this, client)
        }

        client.on('disconnect', () => {
            console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

            Clients.removeClient(client)
        })
    })
}