const path = require('path')
const __public = __dirname + '/../../public'

class Routes {
    constructor(app) {
        this._app = app

        this._app.get('/test', this.getTest.bind(this))
        this._app.get('/wrtc', Routes.getWRTC.bind(this))
    }

    static getWRTC(req, res) {
        res.sendFile(path.resolve(__public + '/wrtc.htm'))
    }

    getTest(req, res) {

    }
}

module.exports = Routes