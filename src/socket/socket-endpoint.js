const Io = require('socket.io');

const webAuth = require('../web-auth.js');

const MSGS = require('./socket-messages.js');
const EVENTS = require('./socket-events.js');

const defaultLoadLimit = 10;

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
		socket.on(EVENTS.onMessageSend, this.onMessageSend.bind(this));

		socket.on(EVENTS.onLoadMessages, this.onLoadMessages.bind(this));
	}

	//region StatusEmits
	emit400(socket) {
		console.log(`ERROR_400 id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onError, MSGS.BadRequest);
		socket.disconnect(true);

		delete this.clients[socket.id];
	}

	emit401(socket) {
		console.log(`ERROR_401 id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onError, MSGS.AuthError);
		socket.disconnect(true);

		delete this.clients[socket.id];
	}

	emit200(socket) {
		console.log(`CLIENT_AUTH_SUCCESS id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onAuthenticate, MSGS.Ok);
	}

	emitAuthRequest(socket) {
		console.log(`REQUESt_AUTH id: ${socket.id}, ip: ${socket.handshake.address}`);

		let data = Object.assign({}, MSGS.AuthRequest);

		data.socketId = socket.id;

		socket.emit(EVENTS.onAuthenticate, data);
	}
	//endregion

	//region Events
	onConnection(socket) {
		console.log(`CLIENT_CONNECTED id: ${socket.id}, ip: ${socket.handshake.address}`);

		this.clients[socket.id] = {
			userId: null,
			socketId: socket.id,
			socket: socket,
			isAuthorized: false
		};

		this.registerEvents(socket);
		this.emitAuthRequest(socket);

		socket.on(EVENTS.onAuthenticate, this.onAuthenticate.bind(this));

		socket.on(EVENTS.onDisconnect, () => {
			console.log(`CLIENT_DISCONNECTED id:${socket.id}, ip: ${socket.handshake.address}`);
		});
	}

	onAuthenticate(data) {
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === true) {
			this.emit200(socket);
			return;
		}

		console.log(`CLIENT_AUTH_ATTEMPT id: ${socket.id}, ip: ${socket.handshake.address}`);

		if (data.hasOwnProperty('accessKey') && this.config.accessKey === data.accessKey) {
			client.isAuthorized = true;

			this.emit200(socket);
			return;
		}

		if (!data.hasOwnProperty('sessionId')) {
			this.emit401(socket);
			return;
		}

		let res = webAuth(data.sessionId);

		if (res.hasOwnProperty('success') && res.success === true) {
			client.userId = res.userId;
			client.isAuthorized = true;

			this.dbao.loadUnreadMessagesForUser(res.userId, function(err, result) {
				if (result) {
					console.log(`CLIENT_LOAD_UNREAD id: ${socket.id}, ip: ${socket.handshake.address}`);

					socket.emit(EVENTS.onLoadUnreadMessages, result);
				}

				this.emit200(socket);
			}.bind(this));
			return;
		}

		this.emit401(socket);
	}

	onMessageSend(data) {
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === false) {
			this.emit401(socket);
			return;
		}

		if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('content') || !data.hasOwnProperty('timestamp')) {
			this.emit400(socket);
			return;
		}

		let suid = data.hasOwnProperty('superuserId') ? data.superuserId : null;

		this.dbao.addNewTextMessageRow(data.conversationId, data.content, suid, function(err, result) {
			let emitData =  {
				timestamp: data.timestamp,
				success: true
			};

			if (err) {
				emitData.success = false;
			} else {
				if (result.affectedRows <= 0)
					emitData.success = false;
			}

			socket.emit(EVENTS.onMessageSend, emitData);

			console.log(`CLIENT_MSG_SENT id: ${socket.id}, ip: ${socket.handshake.address}`);
		});
	}

	onLoadMessages(data) {
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === false) {
			this.emit401(socket);
			return;
		}

		if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('skip')) {
			this.emit400(socket);
			return;
		}

		data.userId = client.userId;
		data.limit = data.hasOwnProperty('limit') ? data.limit : defaultLoadLimit;

		this.dbao.loadMessages(data, function(err, result) {
			console.log(`CLIENT_LOAD_MSG id: ${socket.id}, ip: ${socket.handshake.address}`);

			if (err) {
				socket.emit(EVENTS.onLoadMessages, MSGS.MessageLoadError);
			} else {
				socket.emit(EVENTS.onLoadMessages, result);
			}
		}.bind(this));
	}
	//endregion
}

module.exports = SocketEndpoint;