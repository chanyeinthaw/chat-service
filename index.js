const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/SocketClient')
const SignalingServer = require('./src/webrtc/SignalingServer')
const PromiseDBAO = require('./src/database/PromiseDBAO')

const config = require('./config/chat.js')
const signalingConfig = require('./config/signaling.js')

process.on('unhandledRejection', error => {
	console.log('UnhandledRejection', error.code ,error.message)
})

const database = new PromiseDBAO(config.mysql)
const core = new SocketCore(config.port)
const signal = new SocketCore(config.port + 1)

signal.onConnection((client) => {
    let signalingServer = new SignalingServer(signal, client, signalingConfig)
	signalingServer.requestIce()

    client.on('disconnect', () => {
        console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

        signalingServer.removeFeed()
    })
})

core.onConnection((client) => {
	console.log(`CLIENT_CONNECTED id: ${client.id}`)

	core.addClient(new SocketClient(client))

	new ChatEndpoint(core, client, database, config.ioConfig.accessKey)

	client.on('disconnect', () => {
		console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

		core.removeClient(client)
	})
})