const SocketCore = require('../socket/SocketCore')
const SignalingServer = require('./SignalingServer')
const SignalingNextgen = require('./SignalingNextgen')
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

        let sign = new SignalingNextgen(this.server, client)
        sign.requestIce(config)

        // let sig = new SignalingServer(this, client, config)
        // sig.requestIce()

        let call = new CallHandlingEP(this, client, ServiceREPO)

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