const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/SocketClient')
const Dbao = require('./src/database')
const config = require('./config.js')

process.on('unhandledRejection', error => {
	console.log('UnhandledRejection', error.code ,error.message)
})

const database = new Dbao(config.mysql)
const core = new SocketCore(config.port)

core.onConnection((client) => {
	console.log(`CLIENT_CONNECTED id: ${client.id}`)

	core.addClient(new SocketClient(client))

	let chatEp = new ChatEndpoint(core, client, database, config.ioConfig.accessKey)

	client.on('disconnect', () => {
		console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

		core.removeClient(client)
	})
})