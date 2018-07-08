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

        if (!socketId) res.send({error: true})

        res.send({ client: Clients.getClient(socketId)})
    }
}

module.exports = Routes