const path = require('path')
const __public = __dirname + '/../../public'
const Clients = require('../socket/ClientRepository')

class Routes {
    constructor(app) {
        this._app = app

        this._app.get('/test', this.getTest.bind(this))
        this._app.get('/wrtc', Routes.getWRTC.bind(this))
        this._app.get('/clients/:id', Routes.getClient.bind(this))
    }

    static getWRTC(req, res) {
        res.sendFile(path.resolve(__public + '/wrtc.htm'))
    }

    getTest(req, res) {

    }

    static getClient(req, res) {
        let socketId = req.params.id

        if (!socketId) return res.send({client: null})

        let client =  Clients.getClient(socketId)
        if (!client) return res.send({client: null})

        let resp = {
            socketId: client.socketId,
            isAdmin: client.isAdmin,
            isSuperuser: client.isSuperuser,
            isAuthorized: client.isAuthorized
        }

        res.send({ client: resp})
    }
}

module.exports = Routes