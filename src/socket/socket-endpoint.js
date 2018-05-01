const Io = require('socket.io');

const webAuth = require('../web-auth.js');

const MSGS = require('./socket-messages.js');
const EVENTS = require('./socket-events.js');

class SocketEndpoint {
	constructor(port, dbao , config) {
		this.clients = {};
		this.dbao = dbao;
		this.config = config;
		this.server = Io.listen(port);
		console.log(`SERVER_STARTED port: ${port}`);

		this.server.on(EVENTS.onConnection, this.onConnection.bind(this));
	}

	registerEvents(socket) {
		socket.on(EVENTS.onMessage, function(data) {
			this.onMessage(socket, data);
		}.bind(this));

		socket.on(EVENTS.onLoadMessage, function(data) {
			this.onLoadMessage(socket, data);
		}.bind(this));
	}

	//region StatusEmits
	emit401(socket) {
		console.log(`ERROR_401 id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onError, MSGS.AuthError);
		socket.disconnect(true);
	}

	emit200(socket) {
		console.log(`CLIENT_AUTH_SUCCESS id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onAuthenticate, MSGS.Ok);
	}

	emitAuthRequest(socket) {
		console.log(`REQUESt_AUTH id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onAuthenticate, MSGS.AuthRequest);
	}
	//endregion

	//region Events
	onConnection(socket) {
		console.log(`CLIENT_CONNECTED id: ${socket.id}, ip: ${socket.handshake.address}`);

		this.emitAuthRequest(socket);

		socket.on(EVENTS.onAuthenticate, function(data) {
			this.onAuthenticate(socket,data)
		}.bind(this));

		socket.on(EVENTS.onDisconnect, () => {
			console.log(`CLIENT_DISCONNECTED id:${socket.id}, ip: ${socket.handshake.address}`);

		});
	}

	onAuthenticate(socket, data) {
		console.log(`CLIENT_AUTH_ATTEMPT id: ${socket.id}, ip: ${socket.handshake.address}`);

		if (data.hasOwnProperty('accessKey') && this.config.accessKey === data.accessKey) {
			this.emit200(socket);
			this.registerEvents(socket);
			return;
		}

		if (!data.hasOwnProperty('sessionId')) {
			this.emit401(socket);
			return;
		}

		let res = webAuth(data.sessionId);

		if (res.hasOwnProperty('success') && res.success === true) {
			this.clients[socket.id] = { userId: res.userId };

			this.dbao.loadUnreadMessagesForUser(res.userId, function(err, result) {
				if (result) {
					socket.emit(EVENTS.onLoadUnreadMessages, result);
				}

				this.emit200(socket);
				this.registerEvents(socket);
			}.bind(this));
			return;
		}

		this.emit401(socket);
	}

	onMessage(socket, data) {

	}

	onLoadMessage(socket, data) {

	}
	//endregion
}

module.exports = SocketEndpoint;