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
const core = new SocketCore(chatServer.server)

core.onConnection((client) => {
	console.log(`CLIENT_CONNECTED id: ${client.id}`)

	Clients.addClient(new SocketClient(client))

	new ChatEndpoint(core, client, database, config.chatServer.accesskey, config.laravel)

	client.on('disconnect', () => {
		console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

		Clients.removeClient(client)
	})
})

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})