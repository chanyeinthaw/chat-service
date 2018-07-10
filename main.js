const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/Client')
const Clients = require('./src/socket/ClientRepository')
const PromiseDBAO = require('./src/database/PromiseDBAO')
const HTTPServer = require('./src/server/HTTPServer')
const VChatEndpoint = require('./src/chat/VChatEndpont')
// const SignalingServer = require('./src/webrtc/SignalingServer')

const config = require('getconfig')
const app = require('express')()
const ssl = config.ssl

const chatServer = new HTTPServer(app, config.chatServer, ssl)
// const signalingServer = new HTTPServer(app, config.signalingServer, ssl)

function serverErrorHandler(err) {
    if (err) throw err
}

chatServer.serverErrorHandler = serverErrorHandler

chatServer.start()

const database = new PromiseDBAO(config.mysql)
const core = new SocketCore(chatServer.serverSecure)
const coreUnsecure = new SocketCore(chatServer.serverUnsecure)

function onConnection(client) {
    console.log(`CLIENT_CONNECTED id: ${client.id}`)

    Clients.addClient(new SocketClient(client))

    let chatEP = new ChatEndpoint(this, client, database, config.chatServer.accessKey, config.laravel)
    new VChatEndpoint(this, client)

    chatEP.postAuthHandler = () => {
        // new VChatEndpoint(this, client)
    }

    client.on('disconnect', () => {
        console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

        Clients.removeClient(client)
    })
}

core.onConnection(onConnection.bind(core))
coreUnsecure.onConnection(onConnection.bind(coreUnsecure))

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})