const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/Client')
const Clients = require('./src/socket/ClientRepository')
const PromiseDBAO = require('./src/database/PromiseDBAO')
const HTTPServer = require('./src/server/HTTPServer')
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

function onChatConnection(client) {
    console.log(`CLIENT_CONNECTED id: ${client.id}`)

    Clients.addClient(new SocketClient(client))

    let chatEP = new ChatEndpoint(this, client, database, config.chatServer.accessKey, config.laravel)

    chatEP.postAuthHandler = () => {
        // new VChatEndpoint(this, client)
    }

    client.on('disconnect', () => {
        console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

        Clients.removeClient(client)
    })
}

SocketCore.initSockets(chatServer, config.chatServer.secure, onChatConnection)

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})