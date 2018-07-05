const ChatEndpoint = require('./src/chat/ChatEndpoint')
const SocketCore = require('./src/socket/SocketCore')
const SocketClient = require('./src/socket/SocketClient')
const PromiseDBAO = require('./src/database/PromiseDBAO')
const HTTPServer = require('./src/HTTPServer')

const config = require('getconfig')
const app = require('express')()

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Credentials", "true")
    next();
});

const httpServer = new HTTPServer(app, config)
httpServer.serverErrorHandler = (err) => {
    if (err) throw err
}
httpServer.start()

const database = new PromiseDBAO(config.mysql)
const core = new SocketCore(httpServer.server)

core.onConnection((client) => {
	console.log(`CLIENT_CONNECTED id: ${client.id}`)

	core.addClient(new SocketClient(client))

	new ChatEndpoint(core, client, database, config)

	client.on('disconnect', () => {
		console.log(`CLIENT_DISCONNECTED id: ${client.id}`)

		core.removeClient(client)
	})
})

process.on('unhandledRejection', error => {
    console.log('UnhandledRejection', error.code ,error.message)
})