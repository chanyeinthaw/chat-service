const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/Client')
const Clients = require('./src/socket/ClientRepository')
const PromiseDBAO = require('./src/database/PromiseDBAO')
const HTTPServer = require('./src/server/HTTPServer')
const SignalingServer = require('./src/webrtc/SignalingServer')

const webRTCService = require('./src/webrtc/service')
const chatService = require('./src/chat/service')

const config = require('getconfig')
const app = require('express')()
const ssl = config.ssl

const chatServer = new HTTPServer(app, config.chatServer, ssl)
const signalingServer = new HTTPServer(app, config.signalingServer, ssl)

function serverErrorHandler(err) {
    if (err) throw err
}

chatServer.serverErrorHandler = serverErrorHandler
chatServer.start()

signalingServer.serverErrorHandler = serverErrorHandler
signalingServer.start()


const database = new PromiseDBAO(config.mysql)

SocketCore.initSockets(chatServer, config.chatServer.secure, onChatConnection)

webRTCService(signalingServer, config.signalingServer)
chatService(chatServer, database, config.chatServer, config.laravel)

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})