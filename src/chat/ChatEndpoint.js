const EVENTS = require('./events.js')
const MSGS = require('./messages.js')

const webAuth = require('../web-auth.js')

class ChatEndpoint {
    constructor(server, client, db, config) {
        this._server = server
        this._client = client
        this._db = db
        this._accessKey = config.ioConfig.accessKey
        this._config = config
        
        this.registerEvents()
        this.emitAuthRequest()
    }

    //region StatusEmits
    emit400() {
        console.log(`ERROR_400 id: ${this._client.id}, ip: ${this._client.handshake.address}`)

        this._client.emit(EVENTS.onError, MSGS.BadRequest)
        this._client.disconnect(true)

        this._server.removeClient(this._client)
    }

    emit401() {
        console.log(`ERROR_401 id: ${this._client.id}, ip: ${this._client.handshake.address}`)

        this._client.emit(EVENTS.onError, MSGS.AuthError)
        this._client.disconnect(true)

        this._server.removeClient(this._client)
    }

    emit200() {
        console.log(`CLIENT_AUTH_SUCCESS id: ${this._client.id}, ip: ${this._client.handshake.address}`)

        this._client.emit(EVENTS.onAuthenticate, MSGS.Ok)
    }

    emitAuthRequest() {
        console.log(`REQUESt_AUTH id: ${this._client.id}, ip: ${this._client.handshake.address}`)

        let data = Object.assign({}, MSGS.AuthRequest)

        data.socketId = this._client.id

        this._client.emit(EVENTS.onAuthenticate, data)
    }
    //endregion

    //region Events
    async onDeleteConversations(data) {
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === false) {
            this.emit401()
            return
        }

        if (client.isSuperuser && !client.isAdmin) {
            this.emit401()
            return
        }

        if (!data.hasOwnProperty('idArray')) {
            this.emit400()
            return
        }

        let result = null
        let retObj = {success: false}
        try {
            result = await this._db.deleteConversations(data.idArray, client.isSuperuser)
        } catch (e) {
            console.log(`ERROR: deleteConversations`)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
            return
        }
        if (result && result.affectedRows > 0) {
            retObj.success = true
            retObj.idArray = data.idArray
        }

        this._client.emit(EVENTS.onDeleteConversations, retObj)

        if (client.isSuperuser)
            this._server.broadcast(EVENTS.onDeleteConversationAll, retObj)
        else
            this._server.broadcast(EVENTS.onSoftDeleteConversationAll, retObj)
    }

    async onAuthenticate(data) {
        //region auth section
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        console.log(`CLIENT_AUTH_ATTEMPT id: ${data.socketId}`)

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === true) {
            this.emit200()
            return
        }
        //endregion

        //region web auth sub-section
        if (data.hasOwnProperty('accessKey') && data.hasOwnProperty('role') && this._accessKey === data.accessKey) {
            client.authorize()
            client.makeSuperuser()
            if (data.role === 1) client.makeAdmin()

            this.emit200()
            return
        }

        if (!data.hasOwnProperty('sessionId')) {
            this.emit401()
            return
        }
        //endregion

        let res = null

        try {
            res = webAuth(data.sessionId, this._config)
        } catch (e) {
            console.log(`ERROR: ${e.code} ${e.message}`)
            this._client.emit(EVENTS.onError, {
                code: e.code,
                message: e.message
            })
            return
        }

        if (res.hasOwnProperty('success') && res.success === true) {
            client.userId = res.userId
            client.authorize()

            let conversations = null

            try {
                conversations = await this._db.loadConversationsForUser(res.userId)
            } catch (e) {
                console.log(`ERROR: loadConversationsForUser`)

                this._client.emit(EVENTS.onError, {
                    code: e.code,
                    sql: e.sql,
                    message: e.sqlMessage
                })
                return
            }

            for(let i in conversations) {
                if (conversations.hasOwnProperty(i))
                    this._client.join(`channel${conversations[i].id}`)
            }

            let unreadMesages = null

            try {
                unreadMesages = await this._db.loadUnreadMessageForUser(res.userId)
            } catch (e) {
                console.log(`ERROR: loadUnreadMessageForUser`)

                this._client.emit(EVENTS.onError, {
                    code: e.code,
                    sql: e.sql,
                    message: e.sqlMessage
                })
                return
            }

            console.log(`CLIENT_LOAD_UNREAD id: ${this._client.id}, ip: ${this._client.handshake.address}`)
            this._client.emit(EVENTS.onLoadUnreadMessages, unreadMesages)
            this.emit200()

            return
        }

        this.emit401()
    }

    async onMessageSend(data) {
        //region auth section
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === false) {
            this.emit401()
            return
        }

        if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('timestamp')) {
            this.emit400()
            return
        }
        //endregion

        let content = data.hasOwnProperty('content') ? data.content : '',
            image = data.hasOwnProperty('image') ? data.image : '',
            docs = data.hasOwnProperty('docs') ? data.docs : ''
        let suid = data.hasOwnProperty('superuserId') ? data.superuserId : null
        let sent = suid === null ? 2 : 0

        let result = null
        let emitData =  {
            timestamp: data.timestamp,
            success: true
        }

        try {
            result = await this._db.addNewMessageRow(data.conversationId, content, image, docs, sent, suid)
        } catch (e) {
            emitData.success = false

            console.log(`ERROR: loadConversationsForUser`)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
            return
        }

        if (result.affectedRows <= 0)
            emitData.success = false

        if (emitData.success)
            delete result.affectedRows

        this._client.emit(EVENTS.onMessageSend, emitData)

        if (emitData.success) {
            if (client.isSuperuser) {
                this._server.broadcastToRoom(`channel${result.conversation_id}`, EVENTS.onMessageReceived, {
                    messages: [result]
                })
            } else {
                this._client.to(`channel${result.conversation_id}`).emit(EVENTS.onMessageReceived, {
                    messages: [result]
                })
            }
        }

        console.log(`CLIENT_MSG_SENT id: ${this._client.id}, ip: ${this._client.handshake.address}`)
    }

    async onLoadMessages(data) {
        //region auth section
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === false) {
            this.emit401()
            return
        }

        if (!data.hasOwnProperty('conversationId') || !data.hasOwnProperty('skip')) {
            this.emit400()
            return
        }
        //endregion

        if (client.isSuperuser)
            data.userId = data.hasOwnProperty('userId') ? data.userId : -1
        else
            data.userId = client.userId
        data.limit = data.hasOwnProperty('limit') ? data.limit : defaultLoadLimit

        let result = null

        try {
            result = await this._db.loadMessages(data)
        } catch (e) {
            console.log(`ERROR: loadMessages`)

            this._client.emit(EVENTS.onLoadMessages, MSGS.MessageLoadError)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
            return
        }

        console.log(`CLIENT_LOAD_MSG id: ${this._client.id}, ip: ${this._client.handshake.address}`)

        this._client.emit(EVENTS.onLoadMessages, result)
    }

    async onNewConversation(data) {
        //region auth section
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === false) {
            this.emit401()
            return
        }
        //endregion

        let returnObj = {success: false}

        if (data.hasOwnProperty('conversationId')) {
            this._client.join(`channel${data.conversationId}`)

            returnObj.success = true
        }

        try {
            returnObj.conversation = await this._db.loadConversationById(data.conversationId)
        } catch (e) {
            console.log(`ERROR: loadConversationById`)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
        }

        this._server.broadcast(EVENTS.onNewConversation, returnObj)
    }

    onLoadUnloadConversation(data) {
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isSuperuser === false) {
            this.emit401()
            return
        }

        if (!data.hasOwnProperty('type') || !data.hasOwnProperty('channelId')) {
            this.emit400()
            return
        }

        if (data.type === 'join') {
            console.log(`CLIENT_JOIN_CHANNEL: ${data.channelId}`)
            this._client.join(`channel${data.channelId}`)
        } else {
            console.log(`CLIENT_LEAVE_CHANNEL: ${data.channelId}`)
            this._client.leave(`channel${data.channelId}`, (err) => {})
        }

        this._client.emit(EVENTS.onLoadUnloadConversation, { channelId: data.channelId, success: true })
    }

    async onUpdateMessageSentStatus(data) {
        //region auth section
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isAuthorized === false) {
            this.emit401()
            return
        }

        if (!data.hasOwnProperty('idArray')) {
            this.emit400()
            return
        }

        //endregion

        let result = null
        let retObj = {success: false}
        try {
            result = await this._db.updateMessageSentStatus(data.idArray)
        } catch (e) {
            console.log(`ERROR: updateMessageSentStatus`)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
            return
        }
        if (result && result.affectedRows > 0) {
            retObj.success = true
        }
        this._client.emit(EVENTS.onUpdateMessageSentStatus, retObj)
    }

    async onLoadAllConversations(data) {
        if (!data.hasOwnProperty('socketId')) {
            return
        }

        let client = this._server.getClient(data.socketId)
        if (client === null) return

        if (client.isSuperuser === false) {
            this.emit401()
            return
        }

        let result = null
        let retObj = {success: false}
        try {
            result = await this._db.loadAllConversations()
        } catch (e) {
            console.log(`ERROR: onLoadAllConversations`)

            this._client.emit(EVENTS.onError, {
                code: e.code,
                sql: e.sql,
                message: e.sqlMessage
            })
            return
        }
        this._client.emit(EVENTS.onLoadAllConversations, result)
    }
    //endregion

    registerEvents() {
        this._client.on(EVENTS.onAuthenticate, this.onAuthenticate.bind(this));

        this._client.on(EVENTS.onMessageSend, this.onMessageSend.bind(this))

        this._client.on(EVENTS.onLoadMessages, this.onLoadMessages.bind(this))

        this._client.on(EVENTS.onNewConversation, this.onNewConversation.bind(this))

        this._client.on(EVENTS.onLoadUnloadConversation, this.onLoadUnloadConversation.bind(this))

        this._client.on(EVENTS.onUpdateMessageSentStatus, this.onUpdateMessageSentStatus.bind(this))

        this._client.on(EVENTS.onLoadAllConversations, this.onLoadAllConversations.bind(this))

        this._client.on(EVENTS.onDeleteConversations, this.onDeleteConversations.bind(this))
    }
}

module.exports = ChatEndpoint