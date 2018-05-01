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
		socket.on(EVENTS.onMessageSend, function(data) {
			this.onMessageSend(socket, data);
		}.bind(this));

		socket.on(EVENTS.onLoadMessages, function(data) {
			this.onLoadMessages(socket, data);
		}.bind(this));
	}

	//region StatusEmits
	emit400(socket) {
		console.log(`ERROR_400 id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onError, MSGS.BadRequest);
		socket.disconnect(true);
	}

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
					console.log(`CLIENT_LOAD_UNREAD id: ${socket.id}, ip: ${socket.handshake.address}`);

					socket.emit(EVENTS.onLoadUnreadMessages, result);
				}

				this.emit200(socket);
				this.registerEvents(socket);
			}.bind(this));
			return;
		}

		this.emit401(socket);
	}

	onMessageSend(socket, data) {
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

	onLoadMessages(socket, data) {
		if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('skip')) {
			this.emit400(socket);
			return;
		}

		data.userId = this.clients[socket.id].userId;
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