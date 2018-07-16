const SocketCore = require('../socket/SocketCore')
const SignalingServer = require('./SignalingServer')
const CallHandlingEP = require('./CallHandlingEP')

module.exports = (httpServer, config) => {
    let ServiceREPO = {
        admins: [],
        callers: {}
    }

    /**
     * admin =
     * [
     *      socket clients
     * ]
     */

    SocketCore.initSockets(httpServer, config.secure, function (client) {

        let sig = new SignalingServer(this, client, config)
        let call = new CallHandlingEP(client, ServiceREPO)

        sig.requestIce()

        client.on('disconnect', () => {
            let index = ServiceREPO.admins.indexOf(client.id)
            if (index >= 0) {
                ServiceREPO.admins.splice(index, 1)

                call.updateAvailabilityResponse()
            }

            this.broadcastToRoom(client.resources.room, 'message', 'bye')
        })
    })
}