const fs = require('fs')

class HTTPServer {
    constructor(express, config) {
        this._express = express
        this._config = config

        this._secureServer = require('https').createServer( {
            key: fs.readFileSync(config.server.key),
            cert: fs.readFileSync(config.server.cert)
        }, this._express)

        this._unSecureServer = require('http').createServer(this._express)
    }

    start() {
        let port = this._config.server.port
        let unsecurePort = this._config.server.portUnSecure
        let host = this._config.server.host
        if (host) {
            this._secureServer.listen(port, host, this._unSecureServer)
            this._unSecureServer.listen(unsecurePort, host, this._unSecureServer)
        } else {
            this._secureServer.listen(port, this._unSecureServer)
            this._unSecureServer.listen(unsecurePort, this._unSecureServer)
        }

        console.log(`HTTPS Server Started ${host ? host : ':'}:${port}`)
    }

    get server() {
        return this._secureServer
    }

    set serverErrorHandler (value) {
        this._serverErrorHandler = value
    }
}

module.exports = HTTPServer