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

core.onConnection((client) => {
	console.log(`CLIENT_CONNECTED id: ${client.id}`)

	core.addClient(new SocketClient(client))

	new ChatEndpoint(core, client, database, config.ioConfig.accessKey)
	let signalingServer = new SignalingServer(config, client, signalingConfig)

	client.on('disconnect', () => {
		console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

		signalingServer.removeFeed()
		core.removeClient(client)
	})
})