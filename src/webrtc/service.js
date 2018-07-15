const SocketCore = require('../socket/SocketCore')
const SignalingServer = require('./SignalingServer')
const CallHandlingEP = require('./CallHandlingEP')

module.exports = (httpServer, config) => {
    let ServiceREPO = {
        admins: [],
        adminsMap: [],
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
        new CallHandlingEP(client, ServiceREPO)

        sig.requestIce()
    })
}