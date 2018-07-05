const fs = require('fs')

class HTTPServer {
    constructor(express, config) {
        this._express = express
        this._config = config

        if (config.server.secure) {
            this._secureServer = require('https').createServer( {
                key: fs.readFileSync(config.server.key),
                cert: fs.readFileSync(config.server.cert)
            }, this._express)

            this._unSecureServer = require('http').createServer(this._express)
        } else {
            this._unSecureServer = require('http').createServer(this._express)
        }
    }

    start() {
        let port = this._config.server.port
        let unsecurePort = this._config.server.portUnSecure
        let host = this._config.server.host
        if (host) {
            if (this._config.server.secure) {
                this._secureServer.listen(port, host, this._serverErrorHandler)
                this._unSecureServer.listen(unsecurePort, host, this._serverErrorHandler)
            } else {
                this._unSecureServer.listen(unsecurePort, host, this._serverErrorHandler)
            }
        } else {
            if (this._config.server.secure) {
                this._secureServer.listen(port, this._serverErrorHandler)
                this._unSecureServer.listen(unsecurePort, this._serverErrorHandler)
            } else {
                this._unSecureServer.listen(unsecurePort, this._serverErrorHandler)
            }
        }

        console.log(`HTTPS Server Started ${host ? host : ':'}:${this._config.server.secure ? port : unsecurePort}`)
    }

    get server() {
        return this._config.server.secure ? this._secureServer : this._unSecureServer
    }

    set serverErrorHandler (value) {
        this._serverErrorHandler = value
    }
}

module.exports = HTTPServer