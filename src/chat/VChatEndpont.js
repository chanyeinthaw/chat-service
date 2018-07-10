const Clients = require('../socket/ClientRepository')

const EVENTS = {
    emit: {
        callAnswered: 'callAnswered',
        incomingCall: 'incomingCall'
    },

    receive: {
        startCall: 'startCall',
        answerCall: 'answerCall'
    }
}

class VChatEndpoint {
    constructor(server, client) {
        this._server = server
        this._client = client

        this.registerEvents()
    }

    registerEvents() {
        this._client.on(EVENTS.receive.answerCall, this.onAnswerCall.bind(this))
        this._client.on(EVENTS.receive.startCall, this.onStartCall.bind(this))
    }

    onStartCall(data) {
        /**
         * data must contains, callId, callerName, description
         */
        this._server.broadcast(EVENTS.emit.incomingCall, data)
    }

    onAnswerCall(data) {
        /**
         * data must contains, callId
         */
        this._server.broadcast(EVENTS.emit.callAnswered, data)
    }
}

module.exports = VChatEndpoint