const ON = {
    incomingCall: 'incomingCall',
    freeUP: 'freeUP',
    availabilityRequest: 'availabilityRequest',
    switch: 'switch'
}

const EMIT = {
    incomingCall: ON.incomingCall,
    availabilityResponse: 'availabilityResponse'
}

class CallHandlingEP {
    constructor(client, ServiceREPO) {
        this.ServiceREPO = ServiceREPO

        client.on(ON.freeUP, this.onFreeUP.bind(this))
        client.on(ON.incomingCall, this.onIncomingCall.bind(this))
        client.on(ON.availabilityRequest, this.onAvailabilityRequest.bind(this))
        client.on(ON.switch, this.onSwitch.bind(this))

        this._client = client
    }

    getAvailableOperator() {
        let availableAdmin = this.ServiceREPO.admins.pop()

        if (!availableAdmin) return null

        let mapId = this.ServiceREPO.adminsMap.indexOf(availableAdmin.id)

        this.ServiceREPO.adminsMap.splice(mapId, 1)

        return availableAdmin

    }

    onAvailabilityRequest() {
        this._client.emit(EMIT.availabilityResponse, {
            freeOperatorCount: this.ServiceREPO.admins.length
        })
    }

    onFreeUP() {
        if (this.ServiceREPO.adminsMap.indexOf(this._client.id) < 0) {
            this.ServiceREPO.admins.push(this._client)
            this.ServiceREPO.adminsMap.push(this._client.id)
        }
    }

    onSwitch(data) {
        let availableOperator = this.getAvailableOperator()

        if (!availableOperator) {
            let caller = this.ServiceREPO.callers[data.from]

            if (caller) {
                data.busy = true

                caller.emit(EMIT.incomingCall, data)

                delete this.ServiceREPO.callers[data.from]
            }

            return
        }

        this.onFreeUP()

        availableOperator.emit(EMIT.incomingCall, data)
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

            availableAdmin.emit(EMIT.incomingCall, data)
        }
    }
}

module.exports = CallHandlingEP