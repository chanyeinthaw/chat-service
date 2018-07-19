const ON = {
    incomingCall: 'incomingCall',
    freeUP: 'freeUP',
    availabilityRequest: 'availabilityRequest',
    switch: 'switch',
    userHangUp: 'userHangUp'
}

const EMIT = {
    incomingCall: ON.incomingCall,
    availabilityResponse: 'availabilityResponse',
    operator: 'operator',
    userHangUp: ON.userHangUp
}

class CallHandlingEP {
    constructor(server, client, ServiceREPO) {
        this.ServiceREPO = ServiceREPO
        this.server = server

        client.on(ON.freeUP, this.onFreeUP.bind(this))
        client.on(ON.incomingCall, this.onIncomingCall.bind(this))
        client.on(ON.availabilityRequest, this.onAvailabilityRequest.bind(this))
        client.on(ON.switch, this.onSwitch.bind(this))
        client.on(ON.userHangUp, this.onUserHangup.bind(this))

        this._client = client
    }

    updateAvailabilityResponse(client) {
        let data = {
            freeOperatorCount: this.ServiceREPO.admins.length
        }

        if (!client)
            this.server.broadcast(EMIT.availabilityResponse, data)
        else client.emit(EMIT.availabilityResponse, data)
    }

    getAvailableOperator() {
        let id = this.ServiceREPO.admins.pop()
        let availableAdmin = this.server.getClientById(id)

        return availableAdmin ? availableAdmin : null
    }

    onAvailabilityRequest() {
        this.updateAvailabilityResponse(this._client)
    }

    onFreeUP() {
        if (this.ServiceREPO.admins.indexOf(this._client.id) < 0) {
            this.ServiceREPO.admins.push(this._client.id)
            this.updateAvailabilityResponse()
        }
    }

    onSwitch(data) {
        let availableOperator = this.getAvailableOperator()
        this.onFreeUP()

        let caller = this.ServiceREPO.callers[data.from]
        if (!caller) return

        if (!availableOperator) {
            let caller = this.ServiceREPO.callers[data.from]

            data.busy = true

            caller.emit(EMIT.incomingCall, data)

            delete this.ServiceREPO.callers[data.from]

            return
        }

        caller.emit(operator, availableOperator.id)
        availableOperator.emit(EMIT.incomingCall, data)
    }

    onUserHangUp(id) {
        let operator = this.server.getClientById(id)

        if (operator) operator.emit(EMIT.userHangUp)
    }

    onIncomingCall(data) {
        if (data.hasOwnProperty('to') && data.hasOwnProperty('room')) {
            let caller = this.ServiceREPO.callers[data.to]

            if (caller) {
                caller.emit(EMIT.incomingCall, data)

                delete this.ServiceREPO.callers[data.to]
            }
        } else {
            let availableAdmin = this.getAvailableOperator()

            if (!availableAdmin) {
                data.busy = true

                this._client.emit(EMIT.incomingCall, data)

                return
            }

            data.from = this._client.id
            this.ServiceREPO.callers[data.from] = this._client

            this._client.emit(EMIT.operator, availableAdmin.id)
            availableAdmin.emit(EMIT.incomingCall, data)
        }

        this.updateAvailabilityResponse()
    }
}

module.exports = CallHandlingEP