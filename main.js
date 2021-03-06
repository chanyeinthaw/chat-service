const PromiseDBAO = require('./src/database/PromiseDBAO')
const HTTPServer = require('./src/server/HTTPServer')

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

webRTCService(signalingServer, config.signalingServer)
chatService(chatServer, database, config.chatServer, config.laravel)

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})