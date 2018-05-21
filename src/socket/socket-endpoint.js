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

		socket.on(EVENTS.onNewConversation, this.onNewConversation.bind(this));

		socket.on(EVENTS.onLoadUnloadConversation, this.onLoadUnloadConversation.bind(this));

		socket.on(EVENTS.onUpdateMessageSentStatus, this.onUpdateMessageSentStatus.bind(this))

		socket.on(EVENTS.onLoadAllConversations, this.onLoadAllConversations.bind(this));

		socket.on(EVENTS.onDeleteConversations, this.onDeleteConversations.bind(this));
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

	async onDeleteConversations(data) {
        if (!data.hasOwnProperty('socketId')) {
            return;
        }

        if (!this.clients.hasOwnProperty(data.socketId)) {
            return;
        }

        let client = this.clients[data.socketId];
        let socket = client.socket;

        if (client.isAuthorized === false) {
            this.emit401(socket);
            return;
        }

        if (!data.hasOwnProperty('idArray')) {
            this.emit400(socket);
            return;
        }

        let result = null;
        let retObj = {success: false};
        try {
            result = await this.dbao.deleteConversations(data.idArray, client.isSuperuser);
        } catch (e) {
            console.log(`ERROR: deleteConversations`);

            socket.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            });
            return;
        }
        if (result && result.affectedRows > 0) {
            retObj.success = true;
            retObj.idArray = data.idArray;
        }

        socket.emit(EVENTS.onDeleteConversations, retObj);

        if (client.isSuperuser)
        	this.server.sockets.emit(EVENTS.onDeleteConversationAll, retObj);
        else
            this.server.sockets.emit(EVENTS.onSoftDeleteConversationAll, retObj);
	}

	async onAuthenticate(data) {
		//region auth section
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		console.log(`CLIENT_AUTH_ATTEMPT id: ${data.socketId}`);

		if (!this.clients.hasOwnProperty(data.socketId)) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === true) {
			this.emit200(socket);
			return;
		}
		//endregion

		//region web auth sub-section
		if (data.hasOwnProperty('accessKey') && this.config.accessKey === data.accessKey) {
			client.isAuthorized = true;
			client.isSuperuser = true;

			this.emit200(socket);
			return;
		}

		if (!data.hasOwnProperty('sessionId')) {
			this.emit401(socket);
			return;
		}
		//endregion

		let res = null;

		try {
			res = webAuth(data.sessionId);
		} catch (e) {
			console.log(`ERROR: ${e.code} ${e.message}`);
			socket.emit(EVENTS.onError, {
				code: e.code,
				message: e.message
			});
			return;
		}

		if (res.hasOwnProperty('success') && res.success === true) {
			client.userId = res.userId;
			client.isAuthorized = true;
			client.isSuperuser = false;
			
			let conversations = null;
			
			try {
				conversations = await this.dbao.loadConversationsForUser(res.userId);
			} catch (e) {
				console.log(`ERROR: loadConversationsForUser`);
				
				socket.emit(EVENTS.onError, {
					code: e.code,
					sql: e.sql,
					message: e.sqlMessage
				});
				return;
			}
			
			for(let i in conversations) {
				if (conversations.hasOwnProperty(i))
					socket.join(`channel${conversations[i].id}`);
			}
			
			let unreadMesages = null;
			
			try {
				unreadMesages = await this.dbao.loadUnreadMessageForUser(res.userId);
			} catch (e) {
				console.log(`ERROR: loadUnreadMessageForUser`);

				socket.emit(EVENTS.onError, {
					code: e.code,
					sql: e.sql,
					message: e.sqlMessage
				});
				return;
			}

			console.log(`CLIENT_LOAD_UNREAD id: ${socket.id}, ip: ${socket.handshake.address}`);
			socket.emit(EVENTS.onLoadUnreadMessages, unreadMesages);
			this.emit200(socket);

			return;
		}

		this.emit401(socket);
	}

	async onMessageSend(data) {
		//region auth section
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		if (!this.clients.hasOwnProperty(data.socketId)) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === false) {
			this.emit401(socket);
			return;
		}

		if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('timestamp')) {
			this.emit400(socket);
			return;
		}
		//endregion

		let content = data.hasOwnProperty('content') ? data.content : '',
			image = data.hasOwnProperty('image') ? data.image : '',
			docs = data.hasOwnProperty('docs') ? data.docs : '';
		let suid = data.hasOwnProperty('superuserId') ? data.superuserId : null;
		let sent = suid === null ? 2 : 0;

		let result = null;
		let emitData =  {
			timestamp: data.timestamp,
			success: true
		};

		try {
			result = await this.dbao.addNewMessageRow(data.conversationId, content, image, docs, sent, suid);
		} catch (e) {
			emitData.success = false;

			console.log(`ERROR: loadConversationsForUser`);

			socket.emit(EVENTS.onError, {
				code: e.code,
				sql: e.sql,
				message: e.sqlMessage
			});
			return;
		}

		if (result.affectedRows <= 0)
			emitData.success = false;

		if (emitData.success)
			delete result.affectedRows;

		socket.emit(EVENTS.onMessageSend, emitData);

		if (emitData.success) {
			if (client.isSuperuser) {
				this.server.in(`channel${result.conversation_id}`).emit(EVENTS.onMessageReceived, {
					messages: [result]
				});
			} else {
				socket.to(`channel${result.conversation_id}`).emit(EVENTS.onMessageReceived, {
					messages: [result]
				});
			}
		}

		console.log(`CLIENT_MSG_SENT id: ${socket.id}, ip: ${socket.handshake.address}`);
	}

	async onLoadMessages(data) {
		//region auth section
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		if (!this.clients.hasOwnProperty(data.socketId)) {
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
		//endregion

		data.userId = client.userId;
		data.limit = data.hasOwnProperty('limit') ? data.limit : defaultLoadLimit;

		let result = null;

		try {
			result = await this.dbao.loadMessages(data);
		} catch (e) {
			console.log(`ERROR: loadMessages`);

			socket.emit(EVENTS.onLoadMessages, MSGS.MessageLoadError);

			socket.emit(EVENTS.onError, {
				code: e.code,
				sql: e.sql,
				message: e.sqlMessage
			});
			return;
		}

		console.log(`CLIENT_LOAD_MSG id: ${socket.id}, ip: ${socket.handshake.address}`);

		socket.emit(EVENTS.onLoadMessages, result);
	}

	async onNewConversation(data) {
		//region auth section
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		if (!this.clients.hasOwnProperty(data.socketId)) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === false) {
			this.emit401(socket);
			return;
		}
		//endregion

		let returnObj = {success: false};

		if (data.hasOwnProperty('conversationId')) {
			socket.join(`channel${data.conversationId}`);

			returnObj.success = true;
		}

		try {
			returnObj.conversation = await this.dbao.loadConversationById(data.conversationId);
		} catch (e) {
            console.log(`ERROR: loadConversationById`);

            socket.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            });
        }

		this.server.sockets.emit(EVENTS.onNewConversation, returnObj);
	}

	onLoadUnloadConversation(data) {
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		if (!this.clients.hasOwnProperty(data.socketId)) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isSuperuser === false) {
			this.emit401(socket);
			return;
		}

		if (!data.hasOwnProperty('type') || !data.hasOwnProperty('channelId')) {
			this.emit400(socket);
			return;
		}

		if (data.type === 'join') {
			console.log(`CLIENT_JOIN_CHANNEL: ${data.channelId}`);
			socket.join(`channel${data.channelId}`);
		} else {
			console.log(`CLIENT_LEAVE_CHANNEL: ${data.channelId}`);
			socket.leave(`channel${data.channelId}`);
		}

		socket.emit(EVENTS.onLoadUnloadConversation, { channelId: data.channelId, success: true });
	}

	async onUpdateMessageSentStatus(data) {
		//region auth section
		if (!data.hasOwnProperty('socketId')) {
			return;
		}

		if (!this.clients.hasOwnProperty(data.socketId)) {
			return;
		}

		let client = this.clients[data.socketId];
		let socket = client.socket;

		if (client.isAuthorized === false) {
			this.emit401(socket);
			return;
		}

		if (!data.hasOwnProperty('idArray')) {
			this.emit400(socket);
			return;
		}

		//endregion

		let result = null;
		let retObj = {success: false};
		try {
			result = await this.dbao.updateMessageSentStatus(data.idArray);
		} catch (e) {
			console.log(`ERROR: updateMessageSentStatus`);

			socket.emit(EVENTS.onError, {
				code: e.code,
				sql: e.sql,
				message: e.sqlMessage
			});
			return;
		}
		if (result && result.affectedRows > 0) {
			retObj.success = true;
		}
		socket.emit(EVENTS.onUpdateMessageSentStatus, retObj);
	}

	async onLoadAllConversations(data) {
        if (!data.hasOwnProperty('socketId')) {
            return;
        }

        if (!this.clients.hasOwnProperty(data.socketId)) {
            return;
        }

        let client = this.clients[data.socketId];
        let socket = client.socket;

        if (client.isSuperuser === false) {
            this.emit401(socket);
            return;
        }

        let result = null;
        let retObj = {success: false};
        try {
            result = await this.dbao.loadAllConversations();
        } catch (e) {
            console.log(`ERROR: onLoadAllConversations`);

            socket.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            });
            return;
        }
        socket.emit(EVENTS.onLoadAllConversations, result);
	}
	//endregion
}

module.exports = SocketEndpoint;